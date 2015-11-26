'use strict'

var coroutine		= require('coroutine')
  , fs				= require('fs')
  , spawn			= require('child_process').spawn
  , os				= require('os')

var sep

if (os.platform() === 'win32') {
	sep = '\\'
}
else {
	sep = '/'
}


var get_makePathForFile = coroutine(function*(filepath, g) {

    var items, p, d

	if(os.platform() === 'win32') {

		filepath = filepath.replace(/\//g, '\\')
		var drive = filepath[0]

		items = filepath.substr(3).split('\\')
		// console.log(drive, filepath)
		p = drive + ':'
		d = '\\'
	}
	else {
    	// console.log('get_makePathForFile ' + filepath)
		items = filepath.substr(1).split('/')
		p = ''
		d = '/'
	}

	items.pop()

	// console.log(items)
	
	while(items.length) {
		var item = items.shift()
		p += d + item

		var r = yield fs.exists(p, g.resumeWithError)
		if(!r[0]) {
			// console.log('path ' + p + ' absent')
			yield fs.mkdir(p, g.resume)
		}
	}

})

var gen_scan = coroutine(function*(path, g) {

	var dirs = [ path ], pl = path.length + 1
	var resultFiles = [ ]
	while(dirs.length) {
		var dir = dirs.shift()

		var files = yield fs.readdir(dir, g.resume)
		for(var i = 0, l = files.length; i < l; i++) {

			var file = files[i]
			if(file[0] === '.') continue

			var entry = dir + '/' + file
			var stat = yield fs.stat(entry, g.resume)

			if(stat.isDirectory()) {
				dirs.push(entry)
			}
			else {
			    var wc = null, j
			    if( ( j = file.lastIndexOf('.') ) !== -1) {
			    	wc = file.substr(j + 1)
			    }
				resultFiles.push({
					path: entry,
					relative: entry.substr(pl),
					wc: wc
				})

			}
		}
	}

	return resultFiles

})

var gen_scanDirs = coroutine(function*(path, g) {

	var pl = path.length + 1
	var result = [ ]

	var files = yield fs.readdir(path, g.resume)

	for(var i = 0, l = files.length; i < l; i++) {

		var file = files[i]
		if(file[0] === '.') continue

		var entry = path + '/' + file
		var stat = yield fs.stat(entry, g.resume)

		if(stat.isDirectory()) {

			result.push({
				path: entry,
				relative: entry.substr(pl)
			})
		}
	}

	return result

})

function arrayToMap(a, iterator) {
	var m = { }, key
	for(var i = 0, l = a.length; i < l; i++) {
		var item = a[i]
		if( (key = iterator(item)) !== null) {
			m[key] = item
		}
	}
	return m
}

function mergeMaps(m_dest, m_src) {

    for(var key in m_src) {
    	m_dest[key] = m_src[key]
    }

	return m_dest
}

function classicExec(cmd, argv, callback) {

	var p = spawn(cmd, argv), content = '', stderr = ''

	p.stdout.on('data', function (data) {
		content += data
	})

	p.stderr.on('data', function (data) {
		stderr += data
		console.log('stderr ' + data)
	})

	p.on('close', function (code) {
		callback(null, [ content, stderr ])
	})
}

var sampleGenerator = function*() {};

function processGenerators(C) {

    var p = C.prototype
	for (let key of Object.getOwnPropertyNames(p)) {
    	var method = p[key]
     	if('function' === typeof method && method.constructor == sampleGenerator.constructor) {
      		// console.log('dynamic method ' + key)
   			p[key] = coroutine.method(method)
		}
	}

	for (let key of Object.getOwnPropertyNames(C)) {
    	var method = C[key]
    	if('function' === typeof method && method.constructor == sampleGenerator.constructor) {
    		// console.log('static method ' + key)
   			C[key] = coroutine(method)
    	}
	}
}
 

module.exports = {
	classicExec:		classicExec,

	scan:				gen_scan,
	scanDirs:			gen_scanDirs,

	makePathForFile:	get_makePathForFile,

	arrayToMap:			arrayToMap,
	mergeMaps:			mergeMaps,

	processGenerators:  processGenerators,
	sep: sep
}