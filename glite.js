#!/bin/node --harmony
'use strict'

global.app_path = __dirname
global.glite_path = app_path + '/glite'

var coroutine		= require('coroutine')
  , errors			= require('errors')
  , fs				= require('fs')

  , Page			= require('./glite/Page.js')
  , ModuleManager	= require('./glite/ModuleManager.js')

  , JSModule		= require('./glite/JSModule.js')

var gen_main = coroutine(function*(g) {

    // read modules path

    // page

    ModuleManager.path = [ ]

    var mode = 'read_cmd', pages = [ ], project_path = null, pageName = 'index', config_path = null

    for(var i = 0, c = process.argv, l = c.length; i < l; i++) {

    	var item = c[i]

    	if('read_cmd' !== mode && '-' === item[0]) {
    		mode = 'read_cmd'
    	}

    	switch(mode) {
    	case 'read_cmd':

    		switch(item) {
    		case '-modules':
    		case '-pages':
    		case '-project':
    		case '-config':
    			mode = item
			}
			break

    	case '-modules':
    		ModuleManager.path.push(item)
    		break

    	case '-pages':
    		pages.push(item)
    		break

    	case '-project':
    		project_path = item
    		break

    	case '-config':
    		config_path = item
    		break

    	}
    }

    // ModuleManager.path = [ '/home/github_node_modules/gmr/modules' ]
    if(config_path) {
    	var c = JSON.parse('' + (yield fs.readFile(__dirname + '/' + config_path, g.resume)))
    	c = c.versions[process.env[c.env]]

    	if(c['post-process-data']) {
    		JSModule.prePath = c['post-process-data']
    	}
	}

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

