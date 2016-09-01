//
// Copyright (c) Autodesk, Inc. All rights reserved
//
// Large Model Viewer Extractor
// by Cyrille Fauvel - Autodesk Developer Network (ADN)
// January 2015
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
//
// http://blog.niftysnippets.org/2008/03/mythical-methods.html
//
var config =(require ('fs').existsSync ('server/credentials.js') ?
	require ('./credentials')
	: (console.log ('No credentials.js file present, assuming using CONSUMERKEY & CONSUMERSECRET system variables.'), require ('./credentials_'))) ;
var express =require ('express') ;
var request =require ('request') ;
var https =require ('https') ;
// unirest (http://unirest.io/) or SuperAgent (http://visionmedia.github.io/superagent/)
var unirest =require('unirest') ;
var async =require ('async') ;
var events =require('events') ;
var util =require ('util') ;
var fs =require ('fs') ;
var path =require ('path') ;
var uid =require ('gen-uid') ;

function Lmv (bucketName) {
	events.EventEmitter.call (this) ;
	this.bucket =bucketName ;
}
//Lmv.prototype.__proto__ =events.EventEmitter.prototype ;
util.inherits (Lmv, events.EventEmitter) ;

// POST /authentication/v1/authenticate
/*static*/ Lmv.refreshToken =function () {
	console.log ('Refreshing Autodesk Service token') ;
	unirest.post (config.AuthenticateEndPoint)
		.header ('Accept', 'application/json')
		//.proxy ('http://127.0.0.1:8888').followAllRedirects (true) // requires NODE_TLS_REJECT_UNAUTHORIZED=0
		.send (config.credentials)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw 'error' ;
				var authResponse =response.body ;
				console.log ('Token: ' + response.raw_body) ;
				//authResponse.expires_at =Math.floor (Date.now () / 1000) + authResponse.expires_in ;
				fs.writeFile (__dirname + '/../data/token.json', response.raw_body, function (err) {
					if ( err )
						throw err ;
				}) ;
			} catch ( err ) {
				fs.exists (__dirname + '/../data/token.json', function (exists) {
					if ( exists )
						fs.unlink (__dirname + '/../data/token.json', function (err) {}) ;
				}) ;
				console.log ('Token: ERROR! (' + response.statusCode + ')') ;
			}
		})
	;
} ;

/*static*/ Lmv.getToken =function () {
	try {
		var data =fs.readFileSync (__dirname + '/../data/token.json') ; // keep Sync version here
		var authResponse =JSON.parse (data) ;
		return (authResponse.access_token) ;
	} catch ( err ) {
		console.log (err) ;
	}
	return ('') ;
} ;

/*static*/ Lmv.getDefaultBucket =function (name, addKey) {
	addKey =addKey || false ;
	var possible ='abcdefghijklmnopqrstuvwxyz0123456789' ;
	var text ='z' ;
	for ( var i =0 ; i < 32 ; i++ )
		text +=possible.charAt (Math.floor (Math.random () * possible.length)) ;
	name =name || config.bucket || text ;
	if ( addKey === true )
		name +=config.credentials.client_id ;
	return (name) ;
} ;

/*static*/ Lmv.baseEndPoint =function () {
	return (config.BaseEndPoint) ;
} ;

/*static*/ Lmv.version =function () {
	return (config.Version) ;
} ;

// GET /oss/v1/buckets/:bucket/details
Lmv.prototype.checkBucket =function () {
	var self =this ;
	unirest.get (util.format (config.getBucketsDetailsEndPoint, self.bucket))
		.header ('Accept', 'application/json')
		.header ('Content-Type', 'application/json')
		.header ('Authorization', 'Bearer ' + Lmv.getToken ())
		//.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 || !response.body.hasOwnProperty ('key') )
					throw response ;
				fs.writeFile (__dirname + '/../data/' + response.body.key + '.bucket.json', JSON.stringify (response.body), function (err) {
					if ( err )
						console.log ('ERROR: bucket data not saved :(') ;
				}) ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// POST /oss/v1/buckets
Lmv.prototype.createBucket =function (policy) {
	policy =policy || 'transient' ;
	var self =this ;
	unirest.post (config.postBucketsEndPoint)
		.header ('Accept', 'application/json')
		.header ('Content-Type', 'application/json')
		.header ('Authorization', 'Bearer ' + Lmv.getToken ())
		.send ({ 'bucketKey': self.bucket, 'policy': policy })
		.end (function (response) {
			try {
				if ( response.statusCode != 200 || !response.body.hasOwnProperty ('key') )
					throw response ;
				fs.writeFile (__dirname + '/../data/' + response.body.key + '.bucket.json', JSON.stringify (response.body), function (err) {
					if ( err )
						console.log ('ERROR: bucket data not saved :(') ;
				}) ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

Lmv.prototype.createBucketIfNotExist =function (policy) {
	policy =policy || 'transient' ;
	var self =this ;
	unirest.get (util.format (config.getBucketsDetailsEndPoint, self.bucket))
		.header ('Accept', 'application/json')
		.header ('Content-Type', 'application/json')
		.header ('Authorization', 'Bearer ' + Lmv.getToken ())
		//.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 || !response.body.hasOwnProperty ('key') )
					throw response ;
				fs.writeFile (__dirname + '/../data/' + response.body.key + '.bucket.json', JSON.stringify (response.body), function (err) {
					if ( err )
						console.log ('ERROR: bucket data not saved :(') ;
				}) ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				// We need to create one if error == 404 (404 Not Found)
				if ( Number.isInteger (err.statusCode) && err.statusCode == 404 ) {
					unirest.post (config.postBucketsEndPoint)
						.header ('Accept', 'application/json')
						.header ('Content-Type', 'application/json')
						.header ('Authorization', 'Bearer ' + Lmv.getToken ())
						.send ({ 'bucketKey': self.bucket, 'policy': policy })
						.end (function (response) {
							try {
								if ( response.statusCode != 200 || !response.body.hasOwnProperty ('key') )
									throw response ;
								fs.writeFile (__dirname + '/../data/' + response.body.key + '.bucket.json', JSON.stringify (response.body), function (err) {
									if ( err )
										console.log ('ERROR: bucket data not saved :(') ;
								}) ;
								try { self.emit ('success', response.body) ; } catch ( err ) {}
							} catch ( err ) {
								self.emit ('fail', err) ;
							}
						})
					;
				} else {
					self.emit ('fail', err) ;
				}
			}
		})
	;
	return (this) ;
} ;

// PUT /oss/v1/buckets/:bucket/objects/:filename
Lmv.prototype.uploadFile =function (identifier) {
	var self =this ;
	fs.readFile (__dirname + '/../data/' + identifier + '.json', function (err, data) {
		if ( err )
			return (self.emit ('fail', err)) ;
		data =JSON.parse (data) ;
		var serverFile =path.normalize (__dirname + '/../tmp/' + data.name) ;

		fs.stat (serverFile, function (err, stats) {
			if ( err )
				return (self.emit ('fail', err)) ;
			var total =stats.size ;
			var chunkSize =config.fileResumableChunk * 1024 * 1024 ;
			if ( total <= chunkSize )
				self.singleUpload (identifier) ;
			else
				self.resumableUpload (identifier) ;
		}) ;
	}) ;
	return (this) ;
} ;

// PUT /oss/v1/buckets/:bucket/objects/:filename
Lmv.prototype.singleUpload =function (identifier) {
	var self =this ;
	fs.readFile (__dirname + '/../data/' + identifier + '.json', function (err, data) {
		if ( err )
			return (self.emit ('fail', err)) ;
		data =JSON.parse (data) ;
		var serverFile =path.normalize (__dirname + '/../tmp/' + data.name) ;
		var localFile =path.basename (serverFile) ;

		//var endpoint =util.format (config.putFileUploadEndPoint, self.bucket, localFile.replace (/ /g, '+')) ;
		var endpoint =util.format (config.putFileUploadEndPoint, self.bucket, encodeURIComponent (localFile)) ;
		//var total =fs.statSync (serverFile).size ;
		var total =data.size ;
		data.bytesPosted =0 ;

		fs.createReadStream (serverFile)
			.on ('data', function (chunk) {
				data.bytesPosted +=chunk.length ;
				//console.log ('written: ' + data.bytesPosted) ;
				fs.writeFile (__dirname + '/../data/' + identifier + '.json', JSON.stringify (data), function (err) {}) ;
			})
			//.on ('end', function () { console.log ('end written: ' + data.bytesPosted) ; })
			//.on ('finish', function () { console.log ('finish written: ' + data.bytesPosted) ; })
			.pipe ( // pipe is better since it avoids loading all in memory
				unirest.put (endpoint)
					.headers ({
						'Accept': 'application/json',
						'Content-Type': 'application/octet-stream',
						'Authorization': ('Bearer ' + Lmv.getToken ()),
						'Content-Length': total // required from stream
					})
					.end (function (response) {
						try {
							if ( response.statusCode != 200 )
								throw response.statusCode ;
							fs.writeFile (__dirname + '/../data/' + identifier + '.json', JSON.stringify (response.body), function (err) {
								if ( err )
									console.log ('ERROR: file upload data not saved :(') ;
								try { self.emit ('success', response.body) ; } catch ( err ) {}
							}) ;
						} catch ( err ) {
							fs.exists (__dirname + '/../data/' + identifier + '.json', function (exists) {
								if ( exists )
									fs.unlink (__dirname + '/../data/' + identifier + '.json', function (err) {}) ;
							}) ;
							self.emit ('fail', err) ;
						}
					})
			) ;
	}) ;
	return (this) ;
} ;

// PUT /oss/v1/buckets/:bucket/objects/:filename/resumable
Lmv.prototype.resumableUpload =function (identifier) {
	var self =this ;
	fs.readFile (__dirname + '/../data/' + identifier + '.json', function (err, data) {
		if ( err )
			return (self.emit ('fail', err)) ;
		data =JSON.parse (data) ;
		var serverFile =path.normalize (__dirname + '/../tmp/' + data.name) ;
		var localFile =path.basename (serverFile) ;

		//var endpoint =util.format (config.putFileUploadResumableEndPoint, self.bucket, localFile.replace (/ /g, '+')) ;
		var endpoint =util.format (config.putFileUploadResumableEndPoint, self.bucket, encodeURIComponent (localFile)) ;
		var total =data.size ;
		data.bytesPosted =0 ;
		var chunkSize =config.fileResumableChunk * 1024 * 1024 ;
		var nbChunks =Math.round (0.5 + total / chunkSize) ;
		var sessionId ='extract-autodesk-io-' + uid.token () ;

		// pipe is better since it avoids loading all in memory
		var fctChunks =function (n, chunkSize) {
			return (function (callback) {
				var start =n * chunkSize ;
				var end =Math.min (total, (n + 1) * chunkSize) - 1 ;
				var contentRange ='bytes '
					+ start + '-'
					+ end + '/'
					+ total ;
				fs.createReadStream (serverFile, { 'start': start, 'end': end })
					.on ('data', function (chunk) {
						data.bytesPosted +=chunk.length ;
						//console.log ('written: ' + data.bytesPosted) ;
						fs.writeFile (__dirname + '/../data/' + identifier + '.json', JSON.stringify (data), function (err) {}) ;
					})
					//.on ('end', function () { console.log ('end written: ' + data.bytesPosted) ; })
					//.on ('finish', function () { console.log ('finish written: ' + data.bytesPosted) ; })
					.pipe (
						unirest.put (endpoint)
							.headers ({
								'Accept': 'application/json',
								'Content-Type': 'application/octet-stream',
								'Authorization': ('Bearer ' + Lmv.getToken ()),
								'Content-Range': contentRange,
								'Session-Id': sessionId
							})
							.end (function (response) {
								try {
									if ( response.statusCode != 200 && response.statusCode != 202 )
										throw response ;
									callback (null, response.body) ;
								} catch ( err ) {
									callback (err, null) ;
								}
							})
					) ;
			}) ;
		} ;

		var fctChunksArray =Array.apply (null, { length: nbChunks }).map (Number.call, Number) ;
		for ( var i =0 ; i < fctChunksArray.length ; i++ )
			fctChunksArray [i] =fctChunks (i, chunkSize) ;
		async.parallelLimit (
			fctChunksArray,
			10,
			function (err, results) {
				if ( err ) {
					fs.exists (__dirname + '/../data/' + identifier + '.json', function (exists) {
						if ( exists )
							fs.unlink (__dirname + '/../data/' + identifier + '.json', function (err) {}) ;
					}) ;
					return (self.emit ('fail', err)) ;
				}
				try {
					for ( var i =0 ; i < results.length ; i++ ) {
						if ( results [i] ) {
							fs.writeFile (__dirname + '/../data/' + identifier + '.json', JSON.stringify (results [i]), function (err) {
								if ( err )
									console.log ('ERROR: file upload data not saved :(') ;
								try { self.emit ('success', results [i]) ; } catch ( err ) {}
							}) ;
							break ;
						}
					}
				} catch ( err ) {
				}
			}
		) ;
	}) ;

	return (this) ;
} ;

Lmv.prototype.getURN =function (identifier) {
	try {
		var data =fs.readFileSync (__dirname + '/../data/' + identifier + '.json') ; // keep Sync version here
		data =JSON.parse (data) ;
		return (data.objects [0].id) ;
	} catch ( err ) {
		//console.log (__function + ' ' + __line) ;
		//console.log (err) ;
		try {
			var data =fs.readFileSync (__dirname + '/../data/' + identifier + '.resultdb.json') ;
			data =JSON.parse (data) ;
			return (new Buffer (data.urn, 'base64').toString (/*'ansi'*/)) ;
		} catch ( exp ) {
		}
	}
	return ('') ;
} ;

/*static*/ Lmv.getFilename =function (identifier) {
	try {
		var data =fs.readFileSync (__dirname + '/../data/' + identifier + '.json') ; // keep Sync version here
		data =JSON.parse (data) ;
		return (data.name || data.objects [0].key) ;
	} catch ( err ) {
		//console.log (__function + ' ' + __line) ;
		console.log (err) ;
	}
	return ('') ;
} ;

// GET /oss/v1/buckets/:bucketkey/objects/:objectKey/details
Lmv.prototype.checkObjectDetails =function (filename) {
	var self =this ;
	//var endpoint =util.format (config.getFileDetailsEndPoint, self.bucket, filename.replace (/ /g, '+')) ;
	var endpoint =util.format (config.getFileDetailsEndPoint, self.bucket, encodeURIComponent (filename)) ;
	unirest.get (endpoint)
		.header ('Accept', 'application/json')
		.header ('Content-Type', 'application/json')
		.header ('Authorization', 'Bearer ' + Lmv.getToken ())
		//.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 || !response.body.hasOwnProperty ('bucket-key') )
					throw response ;
				var identifier =response.body.objects [0].size + '-' + filename.replace (/[^0-9A-Za-z_-]/g, '') ;
				fs.writeFile (__dirname + '/../data/' + response.body ['bucket-key'] + '.' + identifier + '.json', JSON.stringify (response.body), function (err) {
					if ( err )
						console.log ('ERROR: object data not saved :(') ;
				}) ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// POST /references/v1/setreference
Lmv.prototype.createDependenciesJson =function (connections) {
	var self =this ;
	if ( connections == null )
		return (null) ;
	var master =connections.uniqueIdentifier ;
	var desc ={
		'master': this.getURN (master),
		'dependencies': []
	} ;

	function traverseConnections (master, conn) {
		var items =[] ;
		for ( var i =0 ; i < conn.length ; i++ ) {
			items.push ({
				"file": self.getURN (conn [i].uniqueIdentifier),
				"metadata": {
					"childPath": Lmv.getFilename (conn [i].uniqueIdentifier),
					"parentPath": Lmv.getFilename (master)
				}
			}) ;
			items =items.concat (traverseConnections (conn [i].uniqueIdentifier, conn [i].children)) ;
		}
		return (items) ;
	}
	desc.dependencies =traverseConnections (master, connections.children) ;
	fs.writeFile (__dirname + '/../data/' + master + '.connections.json', JSON.stringify (desc), function (err) {
		if ( err )
			console.log ('ERROR: bucket project connections not saved :(') ;
	}) ;
	return (desc) ;
} ;

Lmv.prototype.setDependencies =function (connections) {
	var self =this ;
	if ( connections == null ) {
		setTimeout (function () { try { self.emit ('success', { 'status': 'ok', 'statusCode': 200 }) ; } catch ( err ) {} }, 100) ;
		return (this) ;
	}
	var desc =this.createDependenciesJson (connections) ;
	unirest.post (config.postSetReferencesEndPoint)
		.headers ({ 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': ('Bearer ' + Lmv.getToken ()) })
		.send (desc)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response.statusCode ;
				try { self.emit ('success', { 'status': 'ok', 'statusCode': 200 }) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// POST /viewingservice/v1/register
Lmv.prototype.register =function (connections) {
	var self =this ;
	var urn =this.getURN (connections.uniqueIdentifier) ;
	var desc ={ 'urn': new Buffer (urn).toString ('base64') } ;

	unirest.post (config.postRegisterEndPoint)
		.headers ({ 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': ('Bearer ' + Lmv.getToken ()) })
		.send (desc)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 && response.statusCode != 201 )
					throw response.statusCode ;
				try { self.emit ('success', { 'status': 'ok', 'statusCode': response.statusCode }) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// GET /viewingservice/v1/:encodedURN/status
// status/all/bubbles params { guid : '067e6162-3b6f-4ae2-a171-2470b63dff12' }
Lmv.prototype.status =function (urn, params) {
	var self =this ;
	var encodedURN =new Buffer (urn).toString ('base64') ;
	params =params || {} ;

	var endpoint =util.format (config.getStatusEndPoint, encodedURN) ;
	unirest.get (endpoint)
		.headers ({ 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': ('Bearer ' + Lmv.getToken ()) })
		.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response.statusCode ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// GET /viewingservice/v1/:encodedURN/all
Lmv.prototype.all =function (urn, params) {
	var self =this ;
	var encodedURN =new Buffer (urn).toString ('base64') ;
	params =params || {} ;

	var endpoint =util.format (config.getAllEndPoint, encodedURN) ;
	unirest.get (endpoint)
		.headers ({ 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': ('Bearer ' + Lmv.getToken ()) })
		.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response.statusCode ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// GET /viewingservice/v1/:encodedURN
Lmv.prototype.bubbles =function (urn, params) {
	var self =this ;
	var encodedURN =new Buffer (urn).toString ('base64') ;
	params =params || {} ;

	var endpoint =util.format (config.getBubblesEndPoint, encodedURN) ;
	unirest.get (endpoint)
		.headers ({ 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': ('Bearer ' + Lmv.getToken ()) })
		.query (params)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response.statusCode ;
				try { self.emit ('success', response.body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// GET /oss/v1/buckets/:bucket/objects/:filename
Lmv.prototype.download =function (identifier) {
	var self =this ;

	var endpoint ='' ;
	var filename ='default.bin' ;
	var accept ='application/octet-stream' ;
	try {
		var data =fs.readFileSync (__dirname + '/../data/' + identifier + '.json') ;
		data =JSON.parse (data) ;
		endpoint =data.objects [0].location ;
		filename =data.objects [0].key ;
		accept =data.objects [0] ['content-type'] ;
	} catch ( err ) {
		// Try to rebuild it ourself
		filename =lmv.Lmv.getFilename (identifier) ;
		if ( filename == '' ) {
			self.emit ('fail', err) ;
			return (this) ;
		}
		//endpoint =util.format (config.getputFileUploadEndPoint, self.bucket, filename.replace (/ /g, '+')) ;
		endpoint =util.format (config.getputFileUploadEndPoint, self.bucket, encodeURIComponent (filename)) ;
	}

	unirest.get (endpoint)
		.headers ({ 'Accept': accept, 'Authorization': ('Bearer ' + Lmv.getToken ()) })
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response.statusCode ;
				try { self.emit ('success', { body: response.body, 'content-type': accept, 'filename': filename }) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;
	return (this) ;
} ;

// GET /viewingservice/v1/items/:encodedURN
Lmv.prototype.downloadItem =function (urn) { // TODO: range header?
	var self =this ;
	var encodedURN =encodeURIComponent (urn) ;
	//console.log ('Downloading: ' + urn) ;

	var endpoint =util.format (config.getItemsEndPoint, encodedURN) ;
	unirest.get (endpoint)
		.headers ({ 'Authorization': ('Bearer ' + Lmv.getToken ()) })
		.encoding (null)
		//.timeout (2 * 60 * 1000) // 2 min
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response.statusCode == undefined ? 404 : response.statusCode ;
				try { self.emit ('success', response.raw_body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
		/*
		request.get ().pipe ()

		unirest.get ().end ().pipe (fs.createWriteStream ('myfile.txt'))
		*/
	;
	return (this) ;
} ;

// GET /viewingservice/v1/thumbnails/:encodedURN
Lmv.prototype.thumbnail =function (urn, width, height) {
	var self =this ;
	var encodedURN =new Buffer (urn).toString ('base64') ;

	var endpoint =util.format (config.getThumbnailsEndPoint, encodedURN) ;
	var query ={} ;
	if ( width !== undefined )
		query.width =width ;
	if ( height !== undefined )
		query.height =height ;
	//endpoint =urlmod.format ({ 'query': query, pathname: endpoint }) ;

	unirest.get (endpoint)
		.headers ({ 'Authorization': ('Bearer ' + Lmv.getToken ()) })
		.query (query)
		.encoding (null)
		.end (function (response) {
			try {
				if ( response.statusCode != 200 )
					throw response.statusCode ;
				try { self.emit ('success', response.raw_body) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		})
	;

	/*var xhr =new XMLHttpRequest () ;
	xhr.open ('GET', config.BaseEndPoint + endpoint, true) ;
	xhr.setRequestHeader ('Authorization', 'Bearer ' + Lmv.getToken ()) ;
	xhr.responseType ='arraybuffer' ;
	xhr.onload =function (e) {
		if ( this.status == 200 ) {
			try {
				var byteArray =new Uint8Array (this.response) ;
				var buffer =new Buffer (byteArray.length) ;
				for ( var i =0 ; i < byteArray.length ; i++)
					buffer.writeUInt8 (byteArray [i], i) ;
				try { self.emit ('success', buffer) ; } catch ( err ) {}
			} catch ( err ) {
				self.emit ('fail', err) ;
			}
		}
	} ;
	try {
		xhr.send () ;
	} catch ( err ) {
		self.emit ('fail', err) ;
	}*/

	return (this) ;
} ;

var router =express.Router () ;
router.Lmv =Lmv ;

module.exports =router ;

if ( !Number.isInteger ) {
	Number.isInteger =function isInteger (nVal) {
		return (
		typeof nVal === 'number'
		&& isFinite (nVal)
		&& nVal > -9007199254740992
		&& nVal < 9007199254740992
		&& Math.floor (nVal) === nVal
		) ;
	} ;
}

Object.defineProperty (global, '__stack', {
	get: function () {
		var orig =Error.prepareStackTrace ;
		Error.prepareStackTrace = function (_, stack) {
			return (stack) ;
		} ;
		var err =new Error ;
		Error.captureStackTrace (err, arguments.callee) ;
		var stack =err.stack ;
		Error.prepareStackTrace =orig ;
		return (stack);
	}
}) ;

Object.defineProperty (global, '__line', {
	get: function () {
		return (__stack [1].getLineNumber ()) ;
	}
}) ;

Object.defineProperty (global, '__function', {
	get: function () {
		return (__stack [1].getFunctionName ()) ;
	}
}) ;
