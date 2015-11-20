#!/bin/node --harmony
'use strict'

global.app_path = __dirname
global.glite_path = app_path + '/glite'

var coroutine		= require('coroutine')
  , errors			= require('errors')
  , fs				= require('fs')
  , utils			= require(glite_path + '/utils.js')
  , util			= require('util')
  , os				= require('os')

var config = {
	data: 	'/var/lib/gravity/modulePreprocess',
	ts: 	'/home/node4/node-v4.2.1-linux-x64/node_modules/.bin/tsc'
}

// console.log(process.env)
var old = console.log
class SmartLogger {
	// some dirty magic
	constructor() {

		this.groups = { }
		this.last = null

		var l = this.log.bind(this) 
		l.setTopGroup = this.setTopGroup.bind(this)
		l.setGroup = this.setGroup.bind(this)
		l.drawGroups = this.drawGroups.bind(this)
		l.goTop = this.goTop.bind(this)
		return l
	}

	setTopGroup(name) {

		if(!(name in this.groups)) {
			this.groups[name] = { name: name }
		}

		this.last = this.groups[name]

	}

	setGroup(name) {
		this.last[name] = { top: this.last, name: name }
		this.last = this.last[name]
	}

	goTop() {
		this.last = this.last.top
	}

	drawGroups() {
		var t = this.last, p = [ ]
		do {
			p.unshift(t)
			t = t.top
		}
		while(t)

		// old(p)
		
		for(var i = 0, l = p.length; i < l; i ++) {
			var item = p[i]
			if(!item) continue
			if(!item.drawed) {
				item.drawed = true
				old(item.name)
			}
		}
	}

	log() {
	}

}

var log = new SmartLogger
console.log = function() {
	log.drawGroups()
	old.apply(old, arguments)
}
// log()

var reClass		= /class\s+(\S+)/m
var reUse		= /\/\/\s+use\:\s+(\S+)/mg
var globalFileMap = { }

function getDepModules(moduleConfig) {
	var dep = { }

	if(moduleConfig.use) {
		var list = moduleConfig.use.split(/,/)
		for(var i = 0, l = list.length; i < l; i++) {
			var pair = list[i].split('|')
			dep[pair[0]] = pair[1].substr(0,1)
		}
	}

	return dep
}

var gen_makeOrder = coroutine(function*(list, gen_makeDep, itemKeyMaker, g) {

	var order = [ ], done = { }, flag = true
	while(flag) {
		flag = false
		for(var i1 = 0, l1 = list.length; i1 < l1; i1++) {
			var item = list[i1]
			if(item.done) continue

			if(!item.dep) {
				item.dep = yield gen_makeDep(item, g.resume)
			}

			var all_dep = true
			for(var i2 = 0, c2 = item.dep, l2 = c2.length; i2 < l2; i2++) {
				var dep = c2[i2]
				if(dep in done) continue
				all_dep = false
				break
			}

			if(!all_dep) continue

			item.done = true
			done[itemKeyMaker(item)] = true
			order.push(item)

			flag = true
		}
	}

	return order
})

var processedModules = { }

class Module {

	constructor(path, name, version) {
		this.name		= name
		this.version	= version
		this.path		= path
		this.fileMap	= { }
	}

	*readFiles(self, g) {
		var files = yield utils.scan(self.path + '/' + self.name + '/' + self.version, g.resume)
		var ts = self.ts = [ ]
		for(var i1 = 0, l1 = files.length; i1 < l1; i1++) {
			var item = files[i1]
			if(item.wc === 'ts') {
				ts.push(item)
			}
		}
	}

	setProcessed() {
		if(!(this.name in processedModules)) {
			processedModules[this.name] = { }
		}
		processedModules[this.name][this.version.substr(0,1)] = true

		this.processed = true
	}

	checkDep() {
		var alldep = true
		for(var dname in this.depModules) {
			if(!(dname in processedModules && this.depModules[dname] in processedModules[dname])) {
				alldep = false
				break
			}				
		}

		return alldep
	}

	static *tsIdemDepMaker(item, g) {
		var dep = item.dep = [ ]

		var a, tsc = '' + (yield fs.readFile(item.path, g.resume))
		reUse.lastIndex = 0
		while(a = reUse.exec(tsc)) {
			dep.push(a[1])
		}

		return dep
	}

	*processts(self, item, g) {

		// check for modified
		var src = item.path
		var dst = config.data + '/' + self.name + '/' + self.version + '/' + item.relative

		var js = dst.substr(0, dst.length - 3)
		js += '.js'
		self.fileMap[js.substr(config.data.length + 1)] = { }

		var ssrc = yield fs.stat(src, g.resume)
		if((yield fs.exists(dst, g.resumeWithError))[0]) {
			var sdst = yield fs.stat(dst, g.resume)

			if(Math.floor(ssrc.mtime.getTime() / 1000) === Math.floor(sdst.mtime.getTime() / 1000)) {
				var a, content = '' + (yield fs.readFile(js, g.resume))
				if(a = reClass.exec(content)) {
					var lastClassName = a[1]
					self.classMap.push( '\t' + lastClassName + ': require("' + item.relative + '")' )
				}

				// console.log('skip ' + item.relative + ' not modified')
				return
			}
		}

		console.log('process ' + item.relative)

		var filePath = config.data + '/' + self.name + '/' + self.version + '/' + item.relative
		yield utils.makePathForFile(filePath, g.resume)

		var tsc = '' + (yield fs.readFile(item.path, g.resume))
		tsc = 'module ' + self.name.replace(/\//g, '_') + ' {\ndeclare function require(m: string): any;\n' + tsc + '\n}'
		// make .d.ts refs
		/// <reference path="/var/lib/gravity/modulePreprocess/pluginManager/3.0/Manager.d.ts" />
		for(var dname in self.depModules) {
			var dver = self.depModules[dname]
			// read all .d.ts
			var dfiles = yield utils.scan(config.data + '/' + dname + '/' + dver + '.0', g.resume)
			// console.log(dfiles)
			for(var i10 = 0, l10 = dfiles.length; i10 < l10; i10++) {
				var ditem = dfiles[i10]
				if(ditem.path.substr(-5) !== '.d.ts') continue
				// console.log(ditem.path)
				tsc = '/// <reference path="' + ditem.path + '" />\n' + tsc
			}
		}

		for(var i = 0, c = item.dep, l = c.length; i < l; i++) {			
			var f = c[i]
			f = f.substr(0, f.length - 2) + 'd.ts'
			tsc = '/// <reference path="./' + f + '" />\n' + tsc
		}

		yield fs.writeFile(filePath, tsc, g.resume)


		// make .d.ts
		var dts = filePath.substr(0, filePath.length - 3)
		dts += '.d.ts'

		var r = yield utils.classicExec(config.ts, [ '-t', 'ES6', filePath, '-d', '--out', dts ], g.resume)
		if(r[0].length) console.log('stdout\n', r[0])
		if(r[1].length) console.log('stderr\n', r[1])

		if(r[0].length === 0) {
			yield fs.utimes(filePath, Math.floor(ssrc.mtime.getTime() / 1000), Math.floor(ssrc.mtime.getTime() / 1000), g.resume)
		}


		// make .js

		r = yield utils.classicExec(config.ts, [ '-t', 'ES6', filePath, '--out', js ], g.resume)
		if(r[0].length) console.log('stdout\n', r[0])
		if(r[1].length) console.log('stderr\n', r[1])

		self.fileMap[js.substr(config.data.length + 1)] = { }


		var content = '' + (yield fs.readFile(js, g.resume)), a
		yield fs.writeFile(js + '.original', content, g.resume)

		// delete head /// refs
		var lines = content.split('\n')
		var res = [ ]
		for(var i2 = 0, l2 = lines.length; i2 < l2; i2++) {
			var line = lines[i2]
			if(line.substr(0,3) === '///') {
				continue
			}
			res.push(line)
		}
		lines = res

        res = [ ]
		lines.shift(); lines.shift(); lines.pop(); lines.pop();
		for(var i2 = 0, l2 = lines.length; i2 < l2; i2++) {
			var line = lines[i2], p
			if( (p = line.indexOf(self.name.replace(/\//g, '_') + '.')) !== -1 || (p = line.indexOf(self.name.replace(/\//g, '_') + '_1.')) !== -1) {
				var str = line.substr(0, p)
				if(/^\s*$/.test(str)) {
					continue
				}
				else {
					// remove namespace\module name
					line = line.replace(new RegExp(self.name.replace(/\//g, '_') + '(?:_1)?\\.', 'g'), '')
				}
			}
			line = line.substr(4)
			res.push(line)
		}
		content = res.join('\n')

		content = '\n' + content

		var rstr = [ ]
		for(var dname in self.depModules) {
			// content = 'var '+dname.replace(/\//g, '_')+' = require("'+dname+'")\n' + content
			rstr.push( dname.replace(/\//g, '_')+' = require("' + dname + '")' )
		}

		for(var i = 0, c = item.dep, l = c.length; i < l; i++) {
			var d = c[i]
			rstr.push( d.substr(0, d.length - 3) + ' = require("' + d + '")' )
		}

		if(rstr.length) {
			content = 'var ' + rstr.join(',') + ';\n' + content
		}


		if(a = reClass.exec(content)) {
			var lastClassName = a[1]
			self.classMap.push( '\t' + lastClassName + ': require("' + item.relative + '")' )
			content += '\n\nmodule.exports = ' + a[1]
		}
		yield fs.writeFile(js, content, g.resume)

	}

	*process(self, g) {

		if(self.processed) {
			return false
		}

		if(!self.ts) {
			yield self.readFiles(g.resume)
		}

		if(self.ts.length === 0) {			
			self.setProcessed()
			return false
		}

		if(!self.config) {
			self.config = JSON.parse('' + (yield fs.readFile(self.path + '/' + self.name + '/' + self.version + '/module.json', g.resume)))
			self.depModules = getDepModules(self.config)
		}

		if(!self.checkDep()) {
			return false
		}

		if(!self.tsorder) {
			self.tsorder = yield gen_makeOrder(
				self.ts,
				Module.tsIdemDepMaker,
				function(item) {
					return item.relative
				},
				g.resume)
		}

		log.setGroup('\n-----\nprocess module ' + self.name + ' ' + self.version + '\n-----\n')

		self.classMap = [ ]
		for(var i = 0, c = self.tsorder, l = c.length; i < l; i++) {
			yield self.processts(c[i], g.resume)
		}

		// check for native index.js
		if( !(yield fs.exists(self.path + '/' + self.name + '/' + self.version + '/index.js', g.resumeWithError))[0] ) {
			// create index.js
			// console.log('create ' + self.name + '/' + self.version + '/index.js')
			var index = 'module.exports = {\n' + self.classMap.join(',\n') + '\n}' // require("' + item.relative + '")'
			var ip = config.data + '/' + self.name + '/' + self.version + '/index.js'
			self.fileMap[ip.substr(config.data.length + 1)] = { }
			yield fs.writeFile(ip, index, g.resume)
		}

		self.setProcessed()
		log.goTop()
		return true
	}

}

for(var i = 0, c = [ Module ], l = c.length; i < l; i ++)
	utils.processGenerators(c[i])

var gen_processPath = coroutine(function*(path, g) {

	log.setTopGroup('process modules in ' + path)
	// console.log('process modules in ' + path)

	var list = JSON.parse('' + (yield fs.readFile(path + '/list.json', g.resume)))
	var modulesList = [ ]
	for(var name in list) {
		var vlist = list[name]
		for(var i = 0, l = vlist.length; i < l; i++) {
			modulesList.push(new Module(path, name, vlist[i]))
		}
	}

	var flag = true
	while(flag) {
		flag = false
		for(var i = 0, l = modulesList.length; i < l; i++) {
			var module = modulesList[i]
			var result = yield module.process(g.resume)
			if(result && !flag) {
				flag = true
			}
		}
	}

	for(var i = 0, l = modulesList.length; i < l; i++) {
		var module = modulesList[i]
		utils.mergeMaps(globalFileMap, module.fileMap)
	}
	yield fs.writeFile(config.data + '/filesMap.json', JSON.stringify(globalFileMap), g.resume)

})

var gen_main = coroutine(function*(g) {

    var mode = 'read_cmd', modules = [ ], config_path = null

    for(var i = 0, c = process.argv, l = c.length; i < l; i++) {
    	var item = c[i]

    	if('read_cmd' !== mode && '-' === item[0]) {
    		mode = 'read_cmd'
    	}

    	switch(mode) {
    	case 'read_cmd':

    		switch(item) {
    		case '-modules':
    		case '-config':
    			mode = item
	    		break
			}
			break

    	case '-modules':
    		modules.push(item)
    		break

    	case '-config':
    		config_path = item
    		break
    	}
    }

    if(config_path) {
    	var c = JSON.parse('' + (yield fs.readFile(__dirname + '/' + config_path, g.resume)))
    	c = c.versions[process.env[c.env]]
    	var m = {
    		tsc: 'ts',
			'post-process-data': 'data'
    	}
    	for(var key in m) {
    		if(key in c) {
    			config[m[key]] = c[key]
    		}
    	}
    }

    // -------------------------------------------------------
    for(var i = 0, l = modules.length; i < l; i++) {
    	var path = modules[i]
    	yield gen_processPath(path, g.resume)
    }

})

gen_main(function(err, result) {
	if(err) {
		console.showError(err)
	}
})
