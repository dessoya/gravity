

var reStart = /%\s*(?:(end\s+(?:for|if))|(for\s+([a-zA-Z_][a-zA-Z_-\d\.]+)\s+in\s+([a-zA-Z_][a-zA-Z_-\d\.]+))|(?:if\s+([a-zA-Z_][a-zA-Z_-\d\.]+))|([a-zA-Z_][a-zA-Z_-\d\.\s\+'/\.\[\]\(\)]+?)|(index))\s*%/
// 1 - end
// 2 - for name in collection
// 3 -     name
// 4 -     collection
// 5 - if
// 6 - var
// 7 - if index

var Tokens = { }

var onCreate = function() { };
var Class = {
	prototype: {
	},
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
			var object = new this // time 0.085
			// console.log(object);
			// console.log(object.onCreate);
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

Tokens.Var = Token.inherit({

	onCreate: function(v) {
		this.type = 'Var'
		this.v = v
	},

	compile: function(config, env) {

		var t = this.expression(this.v)			

		return this.makeLevelAlign(env) + 'text += ' + t + ';\n'
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
	}
})

Tokens.Index = Token.inherit({

	onCreate: function() {
		this.type = 'Index'
	},

	compile: function(config, env) {

		var t = this.makeLevelAlign(env) + 'text += i' + (env.fori - 1) + ';\n';

		return t
	}

})


Tokens.If = Token.inherit({

	onCreate: function(expr) {
		this.type = 'If'
		this.expr = expr
	},

	compile: function(config, env) {
		var t = this.makeLevelAlign(env) + 'if(' + this.expression(this.expr) + ') {\n';
		return t
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

        /*
		// crate tokens
		var r = resource.readTokens(c)
		resource.tokens = r.tokens
		*/

function readTokens(text) {

		var a, tokens = [ ]

		while(text.length) {

			if(a = reStart.exec(text)) {

				if(a.index > 0) {
					tokens.push(Tokens.Const.create(text.substr(0, a.index)))
				}
				text = text.substr(a.index + a[0].length)
				// console.log(a)
				// console.log(text)

				// variable
				if(a[1]) {
					tokens.push(Tokens.End.create())
				}
				// for
				else if(a[2]) {
					tokens.push(Tokens.For.create(a[3], a[4]))
				}
				else if(a[5]) {
				    var t = Tokens.If.create(a[5])
				    console.log(t)
					tokens.push(t)
				}
				else if(a[6] && a[6] !== 'index') {
					tokens.push(Tokens.Var.create(a[6]))
				}
				else if(a[6] === 'index' || a[7]) {
					tokens.push(Tokens.Index.create())
				}
				else {
					console.log(util.inspect(a,{depth:null}))
					break
				}
			}
			else {
				tokens.push(Tokens.Const.create(text))
				break
			}
		}

		return tokens;
	}

function generateFunction(tokens, config, opt) {

	var env = { level: 1, fori: 0 }, text = 'function(params) {\n'
	text += '  var _ = params, text = \'\';\n'

	for(var i = 0, c = tokens, l = c.length; i < l; i++) {
		text += c[i].compile(config, env)
	}

	text += '  return text;\n'
	text += '}'

	return text
}


function htmlCompiler(content, config) {

    config = config ? config : {stripSpaces:true};

	var tokens = readTokens(content);
	// console.log(tokens);

	var content = generateFunction(tokens, {stripSpaces:true}, {});
	// console.log(content)

	return eval('(' + content + ')');
}

function generateFunctionText(content, config) {
    config = config ? config : {stripSpaces:true};

	var tokens = readTokens(content);
	// console.log(tokens);

	var content = generateFunction(tokens, {stripSpaces:true}, {});

	return content
}

module.exports = {
	compile: htmlCompiler,
	generateFunctionText: generateFunctionText
}
