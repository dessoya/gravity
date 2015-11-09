#!/bin/node --harmony
'use strict'

global.app_path = __dirname
global.glite_path = app_path + '/glite'

var coroutine		= require('coroutine')
  , errors			= require('errors')
  , fs				= require('fs')

  , Page			= require('./glite/Page.js')
  , ModuleManager	= require('./glite/ModuleManager.js')

var gen_main = coroutine(function*(g) {

    // read modules path

    // page

    ModuleManager.path = [ ]

    var mode = 'read_cmd', pages = [ ], project_path = null, pageName = 'index'

    for(var i = 0, c = process.argv, l = c.length; i < l; i++) {

    	var item = c[i]

    	if('read_cmd' !== mode && '-' === item[0]) {
    		mode = 'read_cmd'
    	}

    	switch(mode) {
    	case 'read_cmd':

    		switch(item) {
    		case '-modules':
    			mode = 'modules'
	    		break
    		case '-pages':
    			mode = 'pages'
	    		break
    		case '-project':
    			mode = 'project'
	    		break
			}
			break

    	case 'modules':
    		ModuleManager.path.push(item)
    		break

    	case 'pages':
    		pages.push(item)
    		break

    	case 'project':
    		project_path = item
    		break
    	}
    }

    // ModuleManager.path = [ '/home/github_node_modules/gmr/modules' ]

	console.log('Modules: ' + ModuleManager.path.join(','))
	var projectConfig = JSON.parse('' + (yield fs.readFile(project_path, g.resume))).config

	/*
	var module = ModuleManager.Module.create('config', '1.0')
	ModuleManager.modules.config['1.*'] = {
		module: module
	}
	*/

	for(var i = 0, l = pages.length; i < l; i++) {

		var pagePath = pages[i]
		console.log('process page: ' + pagePath)

		var page = Page.create('page|' + pageName, '1.0', pagePath)
		yield page.process(projectConfig, g.resume)

	}

})

gen_main(function(err, result) {
	if(err) {
		console.showError(err)
	}
})

