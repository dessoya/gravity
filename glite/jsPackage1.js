(function(){
'use strict'

var modules = window.modules = { }, m;

var require = function(moduleName) {
	if(moduleName in this.modules) {
		return this.modules[moduleName].module.exports;
	}
	return null
};

var Module = function(parent) {
	this.modules = parent ? parent.modules : { };
	this.module = { exports: { } };
};

Module.prototype = {
	af: function(filename) {
		this.modules[filename] = new Module(this);
	},
	gf: function(filename) {
		return this.modules[filename];
	},
	require: require,
	u: function(moduleList) {
		var list = moduleList.split(',');
		for(var i = 0, l = list.length; i < l; i++) {
			var a = list[i].split('|');
			this.modules[a[0]] = modules[a[0] + '-' + a[1]];
		}
	}
};

