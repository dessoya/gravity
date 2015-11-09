'use strict'

var util = require('util')

var hc = require('./index.js')
/*
var tokens = hc.readTokens('test{% for item in items %} {% item %} : {% index %} {% end for %} test')
console.log(util.inspect(tokens,{depth:null}))
*/

var html = hc.compile('test\n{% for item in items %} {% item %} : {% index %}\n{% end for %}test', {})({ items: [ 'a', 'b' ] })
console.log(html)
