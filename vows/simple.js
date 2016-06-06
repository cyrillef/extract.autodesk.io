var vows =require ('vows') ;
var assert =require ('assert') ;
var fs =require ('fs') ;
var http =require ('http') ;

var api ={
	'get': function (path) {
		return (function () {
			http.get ({ 'host': 'extract.autodesk.io', 'port': 80, 'path': path }, this.callback) ;
		}) ;
	},

	'assertStatus': function (code) {
		return (function (e, res) {
			assert.equal (res.status, code) ;
		}) ;
	}

} ;

// Create a Test Suite
vows.describe ('credential.js test').addBatch ({
	'credential.js': {
		topic: function () {
			return (fs.existsSync ('server/credentials.js')) ;
		},

		'server/credential.js present': function (topic) {
			assert.equal (topic, true) ;
		}
	},
	'keys': {
		topic: function () { return (fs.readFileSync ('server/credentials.js', 'utf8')) ; },

		'credential.js keys': {
			'credential.js consumer key ok': function (topic) {
				assert.equal (topic.indexOf ('<replace with your consumer key>'), -1);
			},
			'credential.js consumer key ok': function (topic) {
				assert.equal (topic.indexOf ('<replace with your consumer secret>'), -1);
			}
		}
	},
	'access_token': {
		topic: api.get ('/api/token'),

		'access_token request success': function (e, res) {
			console.log ('test');
			console.log (JSON.stringify(res));
			//assert.equal (res.statusCode, 200) ;
		},
		'access_token valid': function (e, res) {
			console.log (JSON.stringify(res));
			//assert.isString (res.body) ;
			//assert.equal (res.body, '') ;
		}
	}

// node_modules\.bin\vows --spec vows\*.js
}).export (module, { error: false }) ;

// node vows\simple.js
// }).run () ;
