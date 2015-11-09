'use strict'

var Class			= require('class')
  , coroutine		= require('coroutine')
  , fs				= require('fs')
  , utils			= require(glite_path + '/utils.js')
  , util			= require('util')

var CSSModule = Class.inherit({

	s_init: function() {
		this.cssModule = { }
	},

    s_processFiles: function(files) {

		this.cssModule.files = utils.arrayToMap(files, function(item) {
			if(item.wc != 'css') {
				return null
			}
			return item.relative
		})

    },
/*
    processFiles: coroutine.method(function*(module, g) {
		var files = yield utils.scan(module.path, g.resume)
		module.super('s_processFiles', files)
    })
*/
})

module.exports = CSSModule