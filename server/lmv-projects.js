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
var express =require ('express') ;
var request =require ('request') ;
var bodyParser =require ('body-parser') ;
var fs =require ('fs') ;
var async =require ('async') ;
var moment =require ('moment') ;
var lmv =require ('./lmv') ;
var ejs =require ('ejs') ;
var sendMail =require ('./sendMail') ;

var router =express.Router () ;
router.use (bodyParser.json ()) ;

// List local buckets since we cannot list server buckets
router.get ('/projects/buckets', function (req, res) {
	try {
		fs.readdir ('data', function (err, files) {
			if ( err )
				throw err;
			var files =filterBucket (files, '(.*)\.bucket\.json') ;
			// Verify that the bucket is still valid before returning it
			//async.mapLimit (files, 10,
			//	function (item, callback_map) { // Each tasks execution
			//		fs.readFile ('data/' + item + '.bucket.json', 'utf-8', function (err, content) {
			//				if ( err )
			//					return (callback_map (err, null)) ;
			//				var js =JSON.parse (content) ;
			//				var dt =moment (js.createDate), now =moment () ;
			//				switch ( js.policyKey ) {
			//					case 'transient': // 24h
			//						dt.add (24, 'hours') ;
			//						if ( dt <= now )
			//							return (callback_map (null, null)) ;
			//						break ;
			//					case 'temporary': // 30 days
			//						dt.add (30, 'days') ;
			//						if ( dt <= now )
			//							return (callback_map (null, null)) ;
			//						break ;
			//					default:
			//						break ;
			//				}
			//				callback_map (null, item) ;
			//			}
			//		) ;
			//	},
			//	function (err, results) { //- All tasks are done
			//		if ( err !== undefined && err !== null )
			//			return (res.json ([])) ;
			//		var filtered =results.filter (function (obj) { return (obj != null) ; }) ;
			//		res.json (filtered) ;
			//	}
			//) ;
			res.json (files) ;
		}) ;
	} catch ( err ) {
		res.status (404).send () ;
	}
}) ;

function filterBucket (arr, criteria) {
	var filtered =arr.filter (function (obj) { return (new RegExp (criteria).test (obj)) ; }) ;
	var results =[] ;
	for ( var index =0 ; index < filtered.length ; index++ )
		results.push (new RegExp (criteria).exec (filtered [index]) [1]) ;
	return (results) ;
}

// Get the progress on translating the bucket/identifier
router.get ('/projects/:identifier/progress', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	var urn =new lmv.Lmv (bucket).getURN (identifier) ;
	if ( urn == '' ) {
		// Ok, we might be uploading to oss - we will try to return a file upload progress
		fs.readFile ('data/' + identifier + '.json', function (err, data) {
			try {
				if ( err ) // No luck, let's return a default answer
					throw 'err' ;
				data =JSON.parse (data) ;
				var connections =null ;
				try {
					connections =fs.readFileSync ('data/' + identifier + '.dependencies.json') ;
					connections =JSON.parse (connections) ;
					var size =0, uploaded =0 ;
					async.each (connections,
						function (item, callback) { // Each tasks execution
							fs.readFile ('data/' + item + '.json', function (err, data2) {
								if ( err )
									return (callback (err)) ;
								data2 =JSON.parse (data2) ;
								size +=(data2.hasOwnProperty ('size') ? parseInt (data2.size) : data2.objects [0].size) ;
								uploaded +=(data2.hasOwnProperty ('bytesPosted') ? parseInt (data2.bytesPosted) : data2.objects [0].size) ;
								callback (null) ;
							}) ;
						},
						function (err) { //- All tasks are done
							if ( err !== undefined && err !== null ) {
								console.log ('Something wrong happened during upload') ;
							}
							res.json ({
								'guid': '',
								'progress': 'uploading to oss',
								'startedAt': new Date ().toUTCString (),
								'status': 'requested',
								'success': (Math.floor (100 * uploaded / size) + '%'),
								'urn': ''
							}) ;
						}
					) ;
				} catch ( e ) {
					connections =null ;
					res.json ({
						'guid': '',
						'progress': 'uploading to oss',
						'startedAt': new Date ().toUTCString (),
						'status': 'requested',
						'success': (Math.floor (100 * data.bytesPosted / data.size) + '%'),
						'urn': ''
					}) ;
				}
			} catch ( e ) { // No luck, let's return a default answer
				return (res.json ({
					'guid': '',
					'progress': 'uploading to oss',
					'startedAt': new Date ().toUTCString (),
					'status': 'requested',
					'success': '0%',
					'urn': ''
				})) ;
			}
		}) ;
		return ;
	}
	new lmv.Lmv (bucket).status (urn)
		.on ('success', function (data) {
			//console.log (data) ;
			if ( data.progress == 'complete' )
				fs.writeFile ('data/' + identifier + '.resultdb.json', JSON.stringify (data), function (err) {}) ;
			res.json (data) ;
		})
		.on ('fail', function (err) {
			//console.log (err) ;
			res.status (404).end () ;
		})
	;
}) ;

// Download a single file from its bucket/identifier pair
router.get ('/projects/:identifier/get', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	new lmv.Lmv (bucket).download (identifier)
		.on ('success', function (data) {
			//console.log (data) ;
			res.setHeader ('Content-Type', data ['content-type']) ;
			res.setHeader ('Content-Transfer-Encoding', 'binary') ;
			res.attachment (data.filename) ;
			res.send (data.body).end () ;
		})
		.on ('fail', function (err) {
			//console.log (err) ;
			res.status (404).end () ;
		})
	;
}) ;

// Another way is to use *
//router.get ('/projects/*/*', function (req, res) {
//	var bucket =req.url.split ('/') [2] ;
//	var identifier =req.url.split ('/') [3] ;

// Get details on the bucket/identifier item
// identifier can be the filename
router.get ('/projects/:identifier', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	var filename ;
	try {
		var idData =fs.readFileSync ('data/' + identifier + '.json') ;
		idData =JSON.parse (idData) ;
		if ( idData.hasOwnProperty ('name') )
			filename =idData.name ;
		else
			filename =idData.objects [0].key ;
	} catch ( err ) {
		filename =identifier.replace (/^[0-9]*\-/, '') ;
		var position =filename.length - 3 ;
		filename =[filename.slice (0, position), '.', filename.slice (position)].join ('') ;
	}

	// GET /oss/{apiversion}/buckets/{bucketkey}/objects/{objectKey}/details
	// would work as well, but since we saved it locally, use the local version
	fs.readFile ('data/' + identifier + '.json', 'utf-8', function (err, data) {
		if ( err ) {
			new lmv.Lmv (bucket).checkObjectDetails (filename)
				.on ('success', function (data) {
					res.json (data) ;
				})
				.on ('fail', function (err) {
					res.status (404).end () ;
				})
			;
			return ;
		}
		res.json (JSON.parse (data)) ;
	}) ;
}) ;

// Get details on the bucket
router.get ('/projects', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	// GET /oss/{api version}/buckets/{bucket key}/details
	// would work as well, but since we saved it locally, use the local version
	fs.readFile ('data/' + bucket + '.bucket.json', 'utf-8', function (err, data) {
		if ( err ) {
			new lmv.Lmv (bucket).checkBucket ()
				.on ('success', function (data) {
					res.json (data) ;
				})
				.on ('fail', function (err) {
					res.status (404).end ('No such bucket') ;
				})
			;
			return ;
		}
		res.json (JSON.parse (data)) ;
	}) ;
}) ;

// Submit a new bucket/identifier for translation
router.post ('/projects', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var regex =new RegExp (/^[-_.a-z0-9]{3,128}$/) ;
	if ( !regex.test (bucket) )
		return (res.status (403).send ('Bucket name invalid!')) ;
	var policy ='transient' ;
	var connections =req.body ;

	function traverseConnections (conn) {
		var items =[] ;
		for ( var i =0 ; i < conn.length ; i++ ) {
			items.push (conn [i].uniqueIdentifier) ;
			items =items.concat (traverseConnections (conn [i].children)) ;
		}
		return (items) ;
	}
	console.log ('master: ' + connections.uniqueIdentifier) ;
	var items =[ connections.uniqueIdentifier ] ;
	items =items.concat (traverseConnections (connections.children)) ;
	// This is to help the upload progress bar to be more precise
	fs.writeFile ('data/' + connections.uniqueIdentifier + '.dependencies.json', JSON.stringify (items), function (err) {
		if ( err )
			console.log ('ERROR: project dependencies not saved :(') ;
	}) ;

	async.series ([
		function (callbacks1) {
			new lmv.Lmv (bucket).createBucketIfNotExist (policy)
				.on ('success', function (data) {
					console.log ('Bucket created (or did exist already)!') ;
					callbacks1 (null, 1) ;
				})
				.on ('fail', function (err) {
					console.log ('Failed to create bucket!') ;
					callbacks1 (null, 2) ; // no need to continue if the bucket was not created?
				})
			;
		},

		function (callbacks2) {
			console.log ('async uploading(s)') ;
			async.each (items,
				function (item, callback) { // Each tasks execution
					console.log ('async uploading ' + item) ;
					new lmv.Lmv (bucket).uploadFile (item)
						.on ('success', function (data) {
							console.log (item + ' upload completed!') ;
							callback () ;
						})
						.on ('fail', function (err) {
							console.log ('Failed to upload ' + item) ;
							callback (err) ;
						})
					;
				},
				function (err) { //- All tasks are done
					if ( err !== undefined && err !== null ) {
						console.log ('Something wrong happened during upload') ;
						callbacks2 (err, 3) ;
						return ;
					}

					console.log ('All files uploaded') ;
					new lmv.Lmv (bucket).setDependencies (items.length == 1 ? null : connections)
						.on ('success', function (data) {
							console.log ('References set, launching translation') ;
							new lmv.Lmv (bucket).register (connections)
								.on ('success', function (data) {
									console.log ('URN registered for translation') ;
									// We are done for now!

									// Just remember locally we did submit the project for translation
									var identifier =connections.uniqueIdentifier ;
									var urn =new lmv.Lmv (bucket).getURN (identifier) ;
									urn =new Buffer (urn).toString ('base64') ;

									data ={
										'guid': urn,
										'progress': '0% complete',
										'startedAt': new Date ().toUTCString (),
										'status': 'requested',
										'success': '0%',
										'urn': urn
									} ;
									fs.writeFile ('data/' + identifier + '.resultdb.json', JSON.stringify (data), function (err) {}) ;
									callbacks2 (null, 4) ;
								})
								.on ('fail', function (err) {
									console.log ('URN registration for translation failed: ' + err) ;
									callbacks2 (err, 5) ;
								})
							;
						})
						.on ('fail', function (err) {
							console.log (err) ;
							callbacks2 (err, 6) ;
						})
					;
				}
			) ;
		}
	], function (err, results) {
		//- We are done! email me if any error
		if ( err ) {
			fs.readFile ('views/email-xlt-failed.ejs', 'utf-8', function (err, st) {
				if ( err )
					return ;
				var obj ={ ID: connections.uniqueIdentifier } ;
				var data =ejs.render (st, obj) ;
				sendMail ({
					'from': 'ADN Sparks <adn.sparks@autodesk.com>',
					'replyTo': 'adn.sparks@autodesk.com',
					//'to': 'adn.sparks@autodesk.com',
					'subject': 'Autodesk Forge Viewer Extractor app failed to translate a project',
					'html': data,
					'forceEmbeddedImages': true
				}) ;
			}) ;
			fs.rename (
				'data/' + connections.uniqueIdentifier + '.resultdb.json',
				'data/' + connections.uniqueIdentifier + '.resultdb.failed',
				function (err) {}
			) ;
			return ;
		} else {
			fs.readFile ('data/' + connections.uniqueIdentifier + '.dependencies.json', 'utf-8', function (err, data) {
				if ( err )
					return ;
				data =JSON.parse (data) ;
				for ( var i =0 ; i < data.length ; i++ )
					fs.unlink ('data/' + data [i] + '.json', function (err) {}) ;
				fs.unlink ('data/' + connections.uniqueIdentifier + '.dependencies.json', function (err) {}) ;
				fs.unlink ('data/' + connections.uniqueIdentifier + '.connections.json', function (err) {}) ;
			}) ;
		}
	}) ;

	// We submitted, no clue if it was successful or if it will fail.
	res
		//.status (202) //- 202 Accepted
		.json ({ 'status': 'submitted' }) ;
}) ;

module.exports =router ;
