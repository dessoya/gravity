'use strict'

var Class			= require('class')
  , coroutine		= require('coroutine')
  , fs				= require('fs')
  , utils			= require(glite_path + '/utils.js')
  , util			= require('util')

// var prePath = '/var/lib/gravity/modulePreprocess'
var JSModule = Class.inherit({

/*
	onCreate: function(path, version) {
		this.path = path
		this.version = version
	},
*/

	s_init: function() {
		this.jsModule = { }
	},

    s_processFiles: function(files) {

        // console.log(files)

        var f = this.jsModule.files ? this.jsModule.files : {}
		var f2 = utils.arrayToMap(files, function(item) {
			if(item.wc != 'js') {
				return null
			}
			return item.relative
		})

		this.jsModule.files = utils.mergeMaps(f, f2)

		// console.log(this.jsModule.files)

        f = this.jsModule.html ? this.jsModule.html : {}
		f2 = utils.arrayToMap(files, function(item) {
			if(item.wc != 'html') {
				return null
			}
			return item.relative
		})

		this.jsModule.html = utils.mergeMaps(f, f2)
    },

    processFiles: coroutine.method(function*(module, g) {

		var files = yield utils.scan(module.path, g.resume)
		module.super('s_processFiles', files)

		if(module.name.indexOf('|') === -1) {
			var p = JSModule.prePath + '/' + module.name + '/' + module.version
			var files = yield utils.scan(p, g.resume)
			module.super('s_processFiles', files)
			// console.log(p)
		}
    })

    /*
	processJSFiles: coroutine.method(function*(jsModule, g) {

		var files = yield utils.scan(jsModule.path, g.resume)
		jsModule.jsFiles = files = utils.arrayToMap(files, function(item) {
			if(item.wc != 'js') {
				return null
			}
			return item.relative
		})
		// console.log(util.inspect(files,{depth:null}))

	}),
	*/

	/*
	findModules: coroutine.method(function*(jsModule, g) {

	})
	*/

})

JSModule.prePath = 'c:\\zh\\var\\gravity\\post-process-data'


module.exports = JSModule