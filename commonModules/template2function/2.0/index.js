'use strict'
 
var Tokens = { }

var onCreate = function() { };

var Class = {
	prototype: { },
	inherit: function(opt) {
		var f = function () {};
		var p = f.prototype = {};

		for(var k in this.prototype) {
			p[k] = this.prototype[k];
		}

		for(var k in opt) {
			p[k] = opt[k];
		}

		f.inherit = Class.inherit;

		f.create = function() {
			var object = new this
			object.onCreate.apply(object, arguments)
			return object
		}

		if(!('onCreate' in p)) {
			p.onCreate = onCreate
		}

		return f
	}
}

var Token = Class.inherit({
	makeLevelAlign: function(env) {
		var c = env.level, a = ''
		while(c--) {
			a += '  '
		}
		return a
	},

	expression: function(e) {
		return e.replace(/^([a-zA-Z_])/, '_.$1').replace(/([\[\s\(])([a-zA-Z_])/g, '$1_.$2')
	}
})

Tokens.Const = Token.inherit({

	onCreate: function(c) {
		this.type = 'Const'
		this.c = c
	},

	compile: function(config, env) {
		var t = this.c
		// console.log(t)
		if(config.stripSpaces) {
			// t = t.replace(/^\s+|\s+$/g, '').replace(/\>\s+\</g, '><')
			t = t.replace(/\>\s+\</gm, '><')
			t = t.replace(/\s+\</gm, '<')
			t = t.replace(/\>\s+/gm, '>')
		}
		t = t.replace(/(['\\])/g, '\\$1').replace(/\n/g, '\\n')
		// console.log(t)
		// return this.makeLevelAlign(env) + 'text += \'' + t.replace(/(['\\])/g, '\\$1').replace(/\n/g, '\\n\\\n') + '\';\n'
		return this.makeLevelAlign(env) + 'text += \'' + t + '\';\n'
	}

})

Tokens.End = Token.inherit({

	onCreate: function() {
		this.type = 'End'
	},

	compile: function(config, env) {
		env.level --
		env.fori ++
		var t = this.makeLevelAlign(env) + '}\n';
		return t
	}
})



Tokens.For = Token.inherit({

	onCreate: function(i, c) {
		this.type = 'For'
		this.i = i
		this.c = c
	},

	compile: function(config, env) {
	    var i = 'i'+env.fori, l = 'l'+env.fori, c = 'c'+env.fori
		var t = this.makeLevelAlign(env) + 'for(var '+i+' = 0, '+c+' = _.'+this.c+', '+l+' = '+c+'.length; '+i+' < '+l+'; '+i+'++ ) {\n';
		t += this.makeLevelAlign(env) + '  _.'+this.i+' = '+c+'['+i+'];\n';
		env.fori ++
		env.level ++
		return t
	},

	getRegExpInfo: function() {
		return {
			re: '?:for\\s+([a-zA-Z_][a-zA-Z_-\\d\\.]+)\\s+in\\s+([a-zA-Z_][a-zA-Z_-\\d\\.]+)',
			pockets: 2
		}
	}
})

Tokens.EndFor = Tokens.End.inherit({
	getRegExpInfo: function() {
		return {
			re: 'end\\s+for',
			pockets: 1
		}
	}
})


Tokens.Index = Token.inherit({

	onCreate: function() {
		this.type = 'Index'
	},

	compile: function(config, env) {

		var t = this.makeLevelAlign(env) + 'text += i' + (env.fori - 1) + ';\n';

		return t
	},

	getRegExpInfo: function() {
		return {
			re: 'index',
			pockets: 1
		}
	}

})

Tokens.Var = Token.inherit({

	onCreate: function(v) {
		this.type = 'Var'
		this.v = v
	},

	compile: function(config, env) {

		var t = this.expression(this.v)			

		return this.makeLevelAlign(env) + 'text += ' + t + ';\n'
	},

	getRegExpInfo: function() {
		return {
			re: '[a-zA-Z_][a-zA-Z_-\\d\\.\\s\\+\'/\\.\\[\\]\\(\\)]+?',
			pockets: 1
		}
	}
})



var reStart = null, tokenOrder = [
	  Tokens.For
	, Tokens.EndFor
	, Tokens.Index
	, Tokens.Var
], tokenInfo = [ ]

function readTokens(content) {

    if(null === reStart) {
        var parts = [ ]
        for(var i = 0, l = tokenOrder.length; i < l; i++) {
        	var token = tokenOrder[i]
        	var regexpInfo = token.prototype.getRegExpInfo()
        	parts.push('(' + regexpInfo.re + ')')
        	tokenInfo.push({ token: token, pockets: regexpInfo.pockets })
        }
    	reStart = new RegExp( '\\{?%\\s*(?:' + parts.join('|') + ')\\s*%\\}?' )
    	console.log(reStart)
    }

	var a, tokens = [ ]

	while(content.length) {

		if(a = reStart.exec(content)) {

			if(a.index > 0) {
				tokens.push(Tokens.Const.create(content.substr(0, a.index)))
			}
			content = content.substr(a.index + a[0].length)

			console.log(a)

			for(var i = 0, cp = 1, l = tokenInfo.length; i < l; i++) {
				var info = tokenInfo[i]
				if(a[cp]) {
					var pockets = [ ]
					for(var i = cp, l = cp + info.pockets; i < l; i++) {
						pockets.push(a[i])
					}
					var token = info.token
					tokens.push(token.create.apply(token, pockets))
					break
				}

				cp += info.pockets
				
			}
		}
		else {
			tokens.push(Tokens.Const.create(content))
			break
		}
	}

	return tokens;
}

function generateFunction(tokens, opt) {

	var env = { level: 1, fori: 0 }, text = 'function(params) {\n'
	text += '  var _ = params, text = \'\';\n'

	for(var i = 0, c = tokens, l = c.length; i < l; i++) {
		text += c[i].compile(opt, env)
	}

	text += '  return text;\n'
	text += '}'

	return text
}

function compile(content, opt) {

	var tokens = readTokens(content);

	var content = generateFunction(tokens, opt);
	console.log(content)

	return eval('(' + content + ')');

}

module.exports = {
	compile: compile,
	readTokens: readTokens,
}