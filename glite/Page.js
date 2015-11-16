'use strict'

var Class			= require('class')
  , coroutine		= require('coroutine')
  , fs				= require('fs')
  , Module			= require('./Module.js')
  , JSModule		= require('./JSModule.js')
  , CSSModule		= require('./CSSModule.js')
  , cssMini			= require('css-condense')

  // , HTML			= require('./HTML.js')

  , HTML			= require(glite_path + '/../commonModules/template2function/1.0/index.js')

  , ModuleManager	= require('./ModuleManager.js')

  , util			= require('util')
  , utils			= require(glite_path + '/utils.js')

var Page = Module.inherit({

    configFilename: 'page.json',

	process: coroutine.method(function*(page, projectConfig, g) {

		// 1. load page.json
		yield page.loadConfig(g.resume)

		// 2. find all use's modules
		var result = yield page.collectUseModules(g.resume)
		if(!result) {
			// problem with collecting uses modules
			return
		}

		// 3. make module order
		var order = yield page.getModuleOrder(g.resume)

		var resultCSSpath = page.config.resultPath + '/' + page.config.cssPackage
		var cssfh = yield fs.open(resultCSSpath, 'w', g.resume)

		var resultJSpath = page.config.resultPath + '/' + page.config.jsPackage
		var fh = yield fs.open(resultJSpath, 'w', g.resume)
		yield fs.write(fh, '' + (yield fs.readFile(glite_path + '/jsPackage1.js', g.resume)), g.resume)


		var s = "m = modules['config-1.0'] = new Module;\n\n"
		yield fs.write(fh, s, g.resume)
		yield fs.write(fh, '(function(require, module) {\n\n', g.resume)
		yield fs.write(fh, 'module.exports = ' + JSON.stringify(projectConfig), g.resume)	
		yield fs.write(fh, '\n\n})(require.bind(m) , m.module);\n\n', g.resume)


	
		// 4. make js body
		for(var i = 0, l = order.length; i < l; i++) {

			var module = order[i]
			yield module.processFiles(g.resume)

			var renameMap = { }

			// css
			for(var n1 in module.cssModule.files) {
				var item = module.cssModule.files[n1]

				// cssMini.compress(this.content)

				yield fs.write(cssfh, cssMini.compress('' + (yield fs.readFile(item.path, g.resume))), g.resume)
				yield fs.write(cssfh, '\n', g.resume)
			}

			var s = "m = modules['" + module.name + "-" + module.version + "'] = new Module;\n\n"
			yield fs.write(fh, s, g.resume)

			// templates

			var uses = yield module.getUsesModules(g.resume)

			console.log('module ' + module.name)
			console.log(module.jsModule.html)
			for(var n1 in module.jsModule.html) {
			
				var item = module.jsModule.html[n1]

				yield fs.write(fh, 'm.af(\'' + item.relative + '\');\n\n', g.resume)
				
				yield fs.write(fh, '(function(require, module) {\n\n', g.resume)

				s = '' + (yield fs.readFile(item.path, g.resume))

				// var html = HTML.create()
				// html.tokens = html.readTokens(s).tokens

				yield fs.write(fh, 'module.exports = ', g.resume)

				yield fs.write(fh, HTML.generateFunctionText(s, {stripSpaces:true}), g.resume)				

				// yield fs.write(fh, html.generateFunction({stripSpaces:true}, {}, s), g.resume)
	
				yield fs.write(fh, '\n\n})(require.bind(m.gf(\'' + item.relative + '\')) , m.gf(\'' + item.relative + '\').module);\n\n', g.resume)
			}


			
			
			var u = [ ]
			for(var i1 in uses) {
				u.push(uses[i1].name + '|' + uses[i1].version)
			}
			u.push('config|1.0')

			if(u.length) {
				yield fs.write(fh, "m.u('" + u.join(',') + "');\n", g.resume)
			}



			// todo: files deps
			// make: files deps

			var jsdeps = { }, neededCount = 0
			for(var n1 in module.jsModule.files) {

				neededCount ++

				var item = module.jsModule.files[n1]
				jsdeps[item.relative] = { }
				s = '' + (yield fs.readFile(item.path, g.resume))

				var a, reRquire = /require\(['"]([a-zA-Z\d_]+?\.(?:js|ts))['"]\)/, reqs = jsdeps[item.relative].reqs = [ ]
				while(a = reRquire.exec(s)) {

				    var t1 = a[1]
				    if(t1.substr(-3) === '.ts') {
				    	// var t2 = module.name + '/' + module.version + '/' + t1
				    	var t2 = t1
				    	t1 = t1.substr(0, t1.length - 3) + '.js'
				    	renameMap[t1] = t2
				    	// console.log(t2,t1)
				    }
					reqs.push(t1)
					s = s.substr(a.index + a[0].length)

				}

				/*
				if(reqs.length > 0) {
					console.dir(item)
					console.dir(reqs)
				}
				*/

			}

			console.log(jsdeps, neededCount)
			var installedjs = { }
			var installedCount = 0

			while(installedCount < neededCount) {

				for(var n1 in module.jsModule.files) {
				
				    // console.log('n: ' + n1)
					var item = module.jsModule.files[n1]
				    // console.log(module.jsModule)
					if(item.relative in installedjs) {
						continue
					}

					// check for needed js

					var depOK = true
					for(var i1 = 0, c1 = jsdeps[item.relative].reqs, l1 = c1.length; i1 < l1; i1++) {
						if(! (c1[i1] in installedjs) ) {
							depOK = false
							break
						}
					}

					// console.log('dep', depOK)

					if(!depOK) {
						continue
					}


					if(item.relative !== 'index.js') {
					    var f1 = item.relative
					    if(f1 in renameMap) {
					    	f1 = renameMap[f1]
					    }
						yield fs.write(fh, 'm.af(\'' + f1 + '\');\n\n', g.resume)
					}
				

					yield fs.write(fh, '(function(require, module) {\n\n', g.resume)

					s = '' + (yield fs.readFile(item.path, g.resume))

					yield fs.write(fh, s, g.resume)
	
					if(item.relative !== 'index.js') {
					    var f1 = item.relative
					    if(f1 in renameMap) {
					    	f1 = renameMap[f1]
					    }
						yield fs.write(fh, '\n\n})(require.bind(m.gf(\'' + f1 + '\')) , m.gf(\'' + f1 + '\').module);\n\n', g.resume)
					}
					else {
						yield fs.write(fh, '\n\n})(require.bind(m) , m.module);\n\n', g.resume)
					}

					installedCount ++
					installedjs[item.relative] = true
				}

			}

			// index.js

		}

		yield fs.write(fh, '})();\n\n', g.resume)
		
		yield fs.write(fh, "onLoad = function(){setTimeout(window.modules['" + page.name +'-' + page.version + "'].module.exports,1)};", g.resume)

		yield fs.close(fh, g.resume)

		yield fs.close(cssfh, g.resume)

		var argv = ['-jar',
			// '/home/sc/clcomp/compiler.jar',
			__dirname + '/compiler.jar',
			'--jscomp_off=globalThis',

			//'--compilation_level', 'ADVANCED_OPTIMIZATIONS',
			'--compilation_level', 'SIMPLE_OPTIMIZATIONS',			

			// '--language_in=ECMASCRIPT6',
			'--language_in=ECMASCRIPT6', '--language_out=ECMASCRIPT5',
			'--formatting=pretty_print',

			//'--transpile_only',
			//'--externs', '/home/github_node_modules/gmr/modules/class/1.0/externs.js',

			'--js', resultJSpath ]

		console.log('optimize start')
	    var content = yield utils.classicExec('java', argv, g.resume)
		console.log('optimize end')

	    if(content[1] && content[1].length > 0) {
	    	console.err(content[1])
	    }
	    else {
	    	content = content[0]
		    // console.log(tmpFileName)
		    // console.log(argv)
		    yield fs.writeFile(resultJSpath.substr(0, resultJSpath.length - 3) + '.min.js', content, g.resume)
		}

		// make page
/*
<!doctype hmtl>
<html>
<head>
<title>qd control panel</title>

<meta http-equiv="content-type" content="text/html; charset=UTF-8"/>

<link href="all.css" rel="stylesheet" media="all">
<script type="text/javascript" src="all.js"></script>

</head>
</body>
</html>
<script>onLoad()</script>
*/
		var path = page.config.resultPath + '/' + page.config.htmlPackage

		var content = '<!doctype hmtl><html><head><title>' + page.config.title + '</title><meta http-equiv="content-type" content="text/html; charset=UTF-8"/>'
		content += '<style>' + (yield fs.readFile(resultCSSpath, g.resume)) + '</style>'

		content += '</head><body><script>' + (yield fs.readFile(resultJSpath.substr(0, resultJSpath.length - 3) + '.min.js', g.resume)) + '</script></body></html><script>onLoad()</script>'

		// content += '</head><body><script>' + (yield fs.readFile(resultJSpath, g.resume)) + '</script></body></html><script>onLoad()</script>'


		fs.writeFile(path, content, g.resume)
	    
	    return content


		console.log(util.inspect(order, {depth:null}))

	})

}, JSModule, CSSModule)

module.exports = Page