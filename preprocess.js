#!/bin/node --harmony
'use strict'

global.app_path = __dirname
global.glite_path = app_path + '/glite'

var coroutine		= require('coroutine')
  , errors			= require('errors')
  , fs				= require('fs')
  , utils			= require(glite_path + '/utils.js')
  , os				= require('os')

var config = {
	data: '/var/lib/gravity/modulePreprocess',
	ts: '/home/node4/node-v4.2.1-linux-x64/node_modules/.bin/tsc'
}

var reClass = /class\s+(\S+)/m
var reUse = /\/\/\s+use\:\s+(\S+)/mg

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

var gen_processModule = coroutine(function*(g) {

})

var gen_processPath = coroutine(function*(path, g) {

	console.log('process modules in ' + path)

	// 1. read list
	var list = JSON.parse('' + (yield fs.readFile(path + '/list.json', g.resume)))
	var modulesList = [ ]
	for(var name in list) {
		var vlist = list[name]
		for(var i = 0, l = vlist.length; i < l; i++) {
			modulesList.push({ name: name, version: vlist[i] })
		}
	}

	/*
	modulesList
	[ { name: 'class', version: '1.0' },
	  { name: 'coroutine', version: '1.0' },
	*/

	var fileMap = { }
	
	var processedModules = { }
	var flag = true
	while(flag) {
		flag = false
		for(var i = 0, l = modulesList.length; i < l; i++) {
			var moduleInfo = modulesList[i]
			if(moduleInfo.processed) continue

			var files = yield utils.scan(path + '/' + moduleInfo.name + '/' + moduleInfo.version, g.resume)
			var ts = [ ]
			for(var i1 = 0, l1 = files.length; i1 < l1; i1++) {
				var item = files[i1]
				if(item.wc === 'ts') {
					ts.push(item)
				}
			}

			if(ts.length === 0) {

				if(!(moduleInfo.name in processedModules)) {
					processedModules[moduleInfo.name] = { }
				}
				processedModules[moduleInfo.name][moduleInfo.version.substr(0,1)] = true

				moduleInfo.processed = true
				continue
			}

			console.log('module ' + moduleInfo.name + '/' + moduleInfo.version + ' have ts')

			var moduleConfig = JSON.parse('' + (yield fs.readFile(path + '/' + moduleInfo.name + '/' + moduleInfo.version + '/module.json', g.resume)))
			var depModules = getDepModules(moduleConfig)
			console.log(depModules)
			var alldep = true
			for(var dname in depModules) {
				if(!(dname in processedModules && depModules[dname] in processedModules[dname])) {
					alldep = false
					break
				}				
			}

			if(!alldep) {
				continue
			}


			var lastClassName = null, classMap = []

			var tsorder = [ ], tsdone = { }
			
			var fd_flag = true
			while(fd_flag) {
				fd_flag = false
				for(var i1 = 0, l1 = ts.length; i1 < l1; i1++) {
					var item = ts[i1]
					if(item.done) continue

					if(!item.dep) {
						var tsc = '' + (yield fs.readFile(item.path, g.resume))
						var a, dep = item.dep = [ ] 
						reUse.lastIndex = 0
						while(a = reUse.exec(tsc)) {
							dep.push(a[1])
						}
					}

					var all_dep = true
					for(var i2 = 0, c2 = item.dep, l2 = c2.length; i2 < l2; i2++) {
						var dep = c2[i2]
						if(dep in tsdone) continue
						all_dep = false
						break
					}

					if(!all_dep) continue

					item.done = true
					tsdone[item.relative] = true
					tsorder.push(item)

					fd_flag = true
				}
			}

			console.log(tsorder)

			for(var i1 = 0, l1 = ts.length; i1 < l1; i1++) {
				var item = ts[i1]
				console.log('process ' + item.relative)

				var filePath = config.data + '/' + moduleInfo.name + '/' + moduleInfo.version + '/' + item.relative
				// console.log(filePath)
				yield utils.makePathForFile(filePath, g.resume)

				var tsc = '' + (yield fs.readFile(item.path, g.resume))
				tsc = 'module ' + moduleInfo.name + '{\n' + tsc + '\n}'
				// make .d.ts refs
				/// <reference path="/var/lib/gravity/modulePreprocess/pluginManager/3.0/Manager.d.ts" />
				for(var dname in depModules) {
					var dver = depModules[dname]
					// read all .d.ts
					var dfiles = yield utils.scan(config.data + '/' + dname + '/' + dver + '.0', g.resume)
					// console.log(dfiles)
					for(var i10 = 0, l10 = dfiles.length; i10 < l10; i10++) {
						var ditem = dfiles[i10]
						if(ditem.path.substr(-5) !== '.d.ts') continue

						console.log(ditem.path)

						tsc = '/// <reference path="' + ditem.path + '" />\n' + tsc
					}

				}


				yield fs.writeFile(filePath, tsc, g.resume)

				// make .d.ts
				var dts = filePath.substr(0, filePath.length - 3)
				dts += '.d.ts'

				console.log(yield utils.classicExec(config.ts, [ '-t', 'ES6', filePath, '-d', '--out', dts ], g.resume))

				// make .js
				var js = filePath.substr(0, filePath.length - 3)
				js += '.js'

				console.log(yield utils.classicExec(config.ts, [ '-t', 'ES6', filePath, '--out', js ], g.resume))

				fileMap[js.substr(config.data.length + 1)] = { }

				var content = '' + (yield fs.readFile(js, g.resume)), a
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
					var line = lines[i2]
					if(line.indexOf(moduleInfo.name + '.') !== -1) {
						continue
					}
					line = line.substr(4)
					res.push(line)
				}
				content = res.join('\n')

				content = '\n' + content

				for(var dname in depModules) {
					content = 'var '+dname+' = require("'+dname+'")\n' + content
				}


				if(a = reClass.exec(content)) {
					// console.log(a)
					lastClassName = a[1]
					classMap.push( '\t' + lastClassName + ': require("' + item.relative + '")' )
					content += '\n\nmodule.exports = ' + a[1]
				}
				yield fs.writeFile(js, content, g.resume)
			}

			// create index.js
			var index = 'module.exports = {\n' + classMap.join(',\n') + '\n}' // require("' + item.relative + '")'
			var ip = config.data + '/' + moduleInfo.name + '/' + moduleInfo.version + '/index.js'
			fileMap[ip.substr(config.data.length + 1)] = { }
			yield fs.writeFile(ip, index, g.resume)

			if(!(moduleInfo.name in processedModules)) {
				processedModules[moduleInfo.name] = { }
			}
			processedModules[moduleInfo.name][moduleInfo.version.substr(0,1)] = true

			moduleInfo.processed = true

			flag = true
		}

	}

	// console.log(fileMap)
	// console.log(processedModules)
	yield fs.writeFile(config.data + '/filesMap.json', JSON.stringify(fileMap), g.resume)

	// console.log(modulesList)


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
    			mode = item
	    		break
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
    console.log(config)

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

