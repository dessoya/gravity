'use strict'

var Class			= require('class')
  , coroutine		= require('coroutine')
  , fs				= require('fs')
  , utils			= require(glite_path + '/utils.js')

var ModuleManager = Class.inherit({



})

var modules = ModuleManager.modules = {
}

ModuleManager.findModule = coroutine(function*(moduleName, requiredVersion, g) {

    var pair = requiredVersion.split('.'), majorVersion = pair[0], minorVersion = pair[1]
    for(var i = 0, c = ModuleManager.path, l = c.length; i < l; i++) {
    	var path = c[i] + '/' + moduleName

    	var result = yield fs.exists(path, g.resumeWithError)
    	if(!result[0]) continue

		if(minorVersion == '*') {
			// search top version
	    	var dirs = yield utils.scanDirs(path, g.resume)
	    	var maxVersion = -1
	    	for(var i1 = 0, l1 = dirs.length; i1 < l1; i1++) {
	    		pair = dirs[i1].relative.split('.')
	    		if(majorVersion != pair[0]) {
	    			continue
				}
				var v = parseInt(pair[1])
				if(v > maxVersion) {
					maxVersion = v
				}
	    	}

	    	if(maxVersion != -1) {
	    		path = path + '/' + majorVersion + '.' + maxVersion
	    		var version = moduleName + '-' + majorVersion + '.*'
	    		var item = modules[version] = {
	    			path: path,
	    			version: version,
					realVersion: majorVersion + '.' + maxVersion
	    		}
	    		return item
	    	}
		}

    }
	
	return null
})

ModuleManager.getModule = coroutine(function*(moduleName, requiredVersion, g) {

	if(!ModuleManager.Module) {
		ModuleManager.Module = require('./Module.js').inherit({}, require('./JSModule.js'), require('./CSSModule.js'))
	}
    var version = moduleName + '-' + requiredVersion
	var info = modules[version]
	if(!('module' in info)) {
		info.module = ModuleManager.Module.create(moduleName, info.realVersion, info.path)
		yield info.module.loadConfig(g.resume)
	}

	return info.module

})

ModuleManager.path = [ ]

module.exports = ModuleManager