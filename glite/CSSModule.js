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

        var f = this.cssModule.files ? this.cssModule.files : {}
		var f2 = utils.arrayToMap(files, function(item) {
			if(item.wc != 'css') {
				return null
			}
			return item.relative
		})

		this.cssModule.files = utils.mergeMaps(f, f2)
    },
/*
    processFiles: coroutine.method(function*(module, g) {
		var files = yield utils.scan(module.path, g.resume)
		module.super('s_processFiles', files)
    })
*/
})

module.exports = CSSModule