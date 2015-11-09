'use strict'

var Class			= require('class')
  , coroutine		= require('coroutine')
  , fs				= require('fs')
  , ModuleManager	= require('./ModuleManager.js')
  , utils			= require(glite_path + '/utils.js')
  , util			= require('util')

var Module = Class.inherit({

    configFilename: 'module.json',

	onCreate: function(name, version, path) {
	    this.name = name
	    this.version = version
		this.path = path
		this.super('s_init')
	},

	loadConfig: coroutine.method(function*(module, g) {

		var content = '' + (yield fs.readFile(module.path + '/' + module.configFilename, g.resume))
		module.config = JSON.parse(content)

	}),

	collectUseModules: coroutine.method(function*(module, g) {

		var use = module.config.use ? ( 'string' === typeof module.config.use ? module.config.use.split(',') : module.config.use) : [ ]

		for(var i = 0, l = use.length; i < l; i++) {
			var moduleNameWithVersion = use[i], pair = moduleNameWithVersion.split('|'), moduleName = pair[0], requiredVersion = pair[1]

			var moduleInfo = yield ModuleManager.findModule(moduleName, requiredVersion, g.resume)
			if(null === moduleInfo) {
				console.log("can't find module " + moduleName + " with version " + requiredVersion)
				return false
			}

			var moduleObject = yield ModuleManager.getModule(moduleName, requiredVersion, g.resume)
			yield moduleObject.collectUseModules(g.resume)			
		}

		return true
	}),

	getModuleOrder: coroutine.method(function*(module, g) {

		var order = [ ], uses = yield module.getUsesModules(g.resume)
		var inOrder = { }

		var title = module.name + '-' + module.version
		uses[title] = module

		while(true) {

			var added = false, process = 0
			for(var title in uses) {

				process ++

				var item = uses[title]
				var itemUses = yield item.getUsesModules(g.resume)
				var allInOrder = true
				for(var useTitle in itemUses) {
					if(!(useTitle in inOrder)) {
						allInOrder = false
						break
					}
				}

				if(allInOrder) {
					inOrder[title] = true
					delete uses[title]
					order.push(item)
					added = true
				}
				else {
				}

			}

			if(!added && process > 0) {

				console.log('problem in dep')
				console.log(title)

				console.log(util.inspect(order, {depth:null}))
				console.log(util.inspect(inOrder, {depth:null}))
				console.log(util.inspect(uses, {depth:null}))

				return null
			}

			if(process == 0) {
				break
			}
		
		}

		return order

	}),

	getUsesModules: coroutine.method(function*(module, g) {

	    var uses = { }
		var use = module.config.use ? ( 'string' === typeof module.config.use ? module.config.use.split(',') : module.config.use ) : [ ]

		for(var i = 0, l = use.length; i < l; i++) {
			var moduleNameWithVersion = use[i], pair = moduleNameWithVersion.split('|'), moduleName = pair[0], requiredVersion = pair[1]
			var module = yield ModuleManager.getModule(moduleName, requiredVersion, g.resume)

			uses[moduleName + '-' + requiredVersion] = module

			uses = utils.mergeMaps(uses, yield module.getUsesModules(g.resume))
		}

		return uses
	})
})

module.exports = Module
