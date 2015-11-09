#!/bin/node --harmony
'use strict'

global.app_path = __dirname
global.glite_path = app_path + '/glite'

var coroutine		= require('coroutine')
  , errors			= require('errors')
  , fs				= require('fs')
  , utils			= require(glite_path + '/utils.js')
  , os				= require('os')

// console.log(os.platform())

var gen_main = coroutine(function*(g) {

    var mode = 'read_cmd', project_path = null, config_path = null

    for(var i = 0, c = process.argv, l = c.length; i < l; i++) {

    	var item = c[i]

    	if('read_cmd' !== mode && '-' === item[0]) {
    		mode = 'read_cmd'
    	}

    	switch(mode) {
    	case 'read_cmd':

    		switch(item) {
    		case '-project':
    		case '-config':
    			mode = item
	    		break
			}
			break

    	case '-project':
    		project_path = item
    		break

    	case '-config':
    		config_path = item
    		break

    	}
    }

    var config = {
    	'post-process-data': '/var/lib/gravity/modulePreprocess'
    }

    if(config_path) {
    	var c = JSON.parse('' + (yield fs.readFile(__dirname + '/' + config_path, g.resume)))
    	var m = {
			'post-process-data': 'post-process-data'
    	}
    	for(var key in m) {
    		if(key in c) {
    			config[m[key]] = c[key]
    		}
    	}
    }

    // -------------------------------------------------------

    if(project_path === null) {
    	console.log('usage: glite_debug -project project_path')
    	return
    }

    var projectConfig = '' + (yield fs.readFile(project_path + '/project.json', g.resume))
    projectConfig = JSON.parse(projectConfig)

    var debugPath = projectConfig.debug.http.path

    if( (yield fs.exists(debugPath, g.resumeWithError))[0] ) {
		// var r = yield utils.classicExec('find', [ debugPath, '-empty', '-type', 'd', '-delete' ], g.resume)
		if(os.platform() === 'win32') {
			// console.log([ '/c', 'rmdir', debugPath, "\\s", "\\q" ])
			var r = yield utils.classicExec('cmd', [ '/c', 'rmdir', debugPath, "/s", "/q" ], g.resume)
		}
		else {
			var r = yield utils.classicExec('rm', [ '-rf', debugPath ], g.resume)
		}
	}

	yield fs.mkdir(debugPath, g.resume)
	

	var debugIndexContent = '' + (yield fs.readFile(glite_path + '/debugIndex.html', g.resume))
	yield fs.writeFile(debugPath + '/index.html', debugIndexContent, g.resume)


	// make reps dirs
	yield fs.mkdir(debugPath + '/repositories', g.resume)

	var r = projectConfig.debug.repositories
	r.push(app_path + '/commonModules')

	var names = [ ]
	for(var i = 0, l = r.length; i < l; i++) {
		var item = r[i]

		var sourcePath = item
		var destPath = debugPath + '/repositories/r' + i

		if(os.platform() === 'win32') {
			destPath = destPath.replace(/\//g, '\\')
			sourcePath = sourcePath.replace(/\//g, '\\')
			// console.log([ '/c', 'mklink', '/D', '/J', destPath, sourcePath ])
			yield utils.classicExec('cmd', [ '/c', 'mklink', '/D', '/J', destPath, sourcePath ], g.resume)
		}
		else {
			yield utils.classicExec('ln', [ '-s', sourcePath, destPath ], g.resume)
		}

		names.push('r' + i)
	}

	yield fs.writeFile(debugPath + '/repositories/list.json', JSON.stringify(names), g.resume)

	if(os.platform() === 'win32') {
		yield utils.classicExec('cmd', [ '/c', 'mklink', '/D', '/J', (debugPath + '/pages').replace(/\//g, '\\'), (project_path + '/pages').replace(/\//g, '\\') ], g.resume)
		// project config
		yield utils.classicExec('cmd', [ '/c', 'mklink', (debugPath + '/project.json').replace(/\//g, '\\'), (project_path + '/project.json').replace(/\//g, '\\') ], g.resume)

		yield utils.classicExec('cmd', [ '/c', 'mklink', '/D', '/J', (debugPath + '/pre').replace(/\//g, '\\'), config['post-process-data'] ], g.resume)
	}
	else {
		yield utils.classicExec('ln', [ '-s', project_path + '/pages', debugPath + '/pages' ], g.resume)
		// project config
		yield utils.classicExec('ln', [ '-s', project_path + '/project.json', debugPath + '/project.json' ], g.resume)

		yield utils.classicExec('ln', [ '-s', config['post-process-data'], debugPath + '/pre' ], g.resume)
	}

})

gen_main(function(err, result) {
	if(err) {
		console.showError(err)
	}
})

