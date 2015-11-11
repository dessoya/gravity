'use strict'

global.app_path = __dirname
global.glite_path = app_path + '/glite'

var http			= require('http')
  , utils			= require(glite_path + '/utils.js')

var server = http.createServer()

var preprocessState = false, precallback = null
setInterval(function() {

    if(preprocessState) {
    	return
    }

	preprocessState = true
	utils.classicExec('pre-modules-ts.bat', [ ], function(err, result) {
		if(err) {
			console.log(err)
		}
		else {
			if(result[0]) console.log('stdout\n', result[0])
			if(result[1]) console.log('stderr\n', result[1])
		}
		preprocessState = false
		if(precallback) {
			precallback()
			precallback = null
		}
	})

}, 1000 * 5)

server.on('request', function(req, res) {

    if(preprocessState) {
    	precallback = function() {
			res.setHeader('Access-Control-Allow-Origin', '*')
			res.end()
    	}
    }
    else {

		preprocessState = true
		utils.classicExec('pre-modules-ts.bat', [ ], function(err, result) {
			if(err) {
				console.log(err)
			}
			else {
				if(result[0]) console.log('stdout\n', result[0])
				if(result[1]) console.log('stderr\n', result[1])
			}
			preprocessState = false
			res.setHeader('Access-Control-Allow-Origin', '*')
			res.end()
		})

	}
})

server.listen(90)
