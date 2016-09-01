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
var path =require ('path') ;
var mkdirp =require ('mkdirp') ;
var rimraf =require ('rimraf') ;
var async =require ('async') ;
var unirest =require('unirest') ;
var lmv =require ('./lmv') ;
var AdmZip =require ('adm-zip') ;
var archiver =require ('archiver') ;
var ejs =require ('ejs') ;
var zlib =require ('zlib') ;
var moment =require ('moment') ;
//var nodemailer =require ('nodemailer') ;
//var directTransport =require ('nodemailer-direct-transport') ;
var sendMail =require ('./sendMail') ;
var viewerFileList =require ('./viewer') ;

var router =express.Router () ;
router.use (bodyParser.json ()) ;

/*const*/ var _default_size_ =400000 ;

// Reinit vault
router.get ('/reinit', function (req, res) {
	//var bucket =lmv.Lmv.getDefaultBucket () ;
	var bucket ='cyrille-20151015' ;
	new lmv.Lmv (bucket).checkBucket ()
		.on ('success', function (data) {})
		.on ('fail', function (err) {})
	;
	res.end () ;
}) ;

// List translated projects
router.get ('/results', function (req, res) {
	try {
		fs.readdir (__dirname + '/../data', function (err, files) {
			if ( err )
				throw err ;
			files =filterProject (files, '(.*)\\.resultdb\\.json') ;
			async.mapLimit (files, 10,
				function (file, callback_map) { // Each tasks execution
					fs.readFile (__dirname + '/../data/' + file + '.resultdb.json', 'utf-8', function (err, data) {
						if ( err || data == '' )
							return (callback_map (null, null)) ;
						data =JSON.parse (data) ;
						if ( data.progress == 'failed' || data.status == 'failed' )
							return (callback_map (null, null)) ;
						var out ={
							name: file,
							urn: data.urn,
							date: data.startedAt,
							hasThumbnail: data.hasThumbnail,
							status: data.status,
							success: data.success,
							progress: data.progress
						} ;
						callback_map (null, out)
					}) ;
				},
				function (err, results) { //- All tasks are done
					if ( err !== undefined && err !== null )
						return (res.json ([])) ;
					var filtered =results.filter (function (obj) { return (obj != null) ; }) ;
					res.json (filtered) ;
				}
			) ;
		}) ;
	} catch ( err ) {
		res.status (404).send () ;
	}
}) ;

function filterProject (arr, criteria) {
	var filtered =arr.filter (function (obj) { return (new RegExp (criteria).test (obj)) ; }) ;
	var results =[] ;
	for ( var index =0 ; index < filtered.length ; index++ )
		results.push (new RegExp (criteria).exec (filtered [index]) [1]) ;
	return (results) ;
}

// Download thumbnail from a bucket/identifier pair
router.get ('/results/:identifier/thumbnail', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	var urn =new lmv.Lmv (bucket).getURN (identifier) ;
	if ( urn == '' )
		return (res.json ({ progress: 0 })) ;
	new lmv.Lmv (bucket).thumbnail (urn, 215, 146)
		.on ('success', function (data) {
			try {
				fs.writeFile (__dirname + '/../www/extracted/' + identifier + '.png', data, function (err) {}) ;
			} catch ( err ) {
			}
			res.setHeader ('Content-Type', 'image/png') ;
			res.end (data, 'binary') ;
		})
		.on ('fail', function (err) {
			//console.log (err) ;
			res.status (404).end () ;
		})
	;
}) ;

// Get the bucket/identifier viewable data
router.get ('/results/:identifier', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	var urn =new lmv.Lmv (bucket).getURN (identifier) ;
	if ( urn == '' )
		return (res.status (404).end ()) ;
	new lmv.Lmv (bucket).all (urn)
		.on ('success', function (data) {
			if ( data.progress == 'complete' )
				fs.writeFile (__dirname + '/../data/' + identifier + '.resultdb.json', JSON.stringify (data), function (err) {}) ;
			res.json (data) ;
		})
		.on ('fail', function (err) {
			res.status (404).end () ;
		})
	;
}) ;

// Delete the project from the website
router.delete ('/results/:identifier', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	var urn =new lmv.Lmv (bucket).getURN (identifier) ;
	if ( urn == '' )
		return (res.status (404).end ()) ;
	fs.exists (__dirname + '/../data/' + identifier + '.resultdb.json', function (exist) {
		if ( !exist )
			return (res.status (404).end ()) ;
		fs.unlink (__dirname + '/../data/' + identifier + '.resultdb.json', function (err) { res.end () ; }) ;
		res.end () ;
	}) ;
	fs.exists (__dirname + '/../www/extracted/' + identifier + '.png', function (exist) {
		if ( !exist )
			return ;
		fs.unlink (__dirname + '/../www/extracted/' + identifier + '.png', function (err) {}) ;
	}) ;
	fs.exists (__dirname + '/../www/extracted/' + identifier + '.zip', function (exist) {
		if ( !exist )
			return ;
		fs.unlink (__dirname + '/../www/extracted/' + identifier + '.zip', function (err) {}) ;
	}) ;
}) ;

// Get the bucket/identifier viewable data as a zip file containing all resources
router.get ('/results/:identifier/project', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	var urn =new lmv.Lmv (bucket).getURN (identifier) ;
	if ( urn == '' )
		return (res.status (404).end ()) ;

	fs.exists (__dirname + '/../www/extracted/' + identifier + '.zip', function (exist) {
		if ( exist )
			return ; // Do not proceed again
		fs.exists (__dirname + '/../data/' + identifier + '.lock', function (exists) {
			var list =[] ;
			if ( exists ) {
				if ( req.query.email && req.query.email !== '' ) {
					list =JSON.parse (fs.readFileSync (__dirname + '/../data/' + identifier + '.lock')) ;
					list.push (req.query.email) ;
					fs.writeFile (__dirname + '/../data/' + identifier + '.lock', JSON.stringify (list), function (err) {}) ;
				}
				return ; // Do not proceed again
			} else {
				fs.writeFile (__dirname + '/../data/' + identifier + '.lock', JSON.stringify (list), function (err) {}) ;
			}
			extractorProgressMgr.release (identifier) ;

			try {
				rimraf (__dirname + '/../data/' + identifier, function (err) {
					if ( err )
						throw err ;
					async.waterfall ([
								function (callback_wf1a) { wf1_GetFullDetails (callback_wf1a, bucket, identifier, urn) ; }, // Get latest full details
								function (data, callback_wf1b) { wf1_GetItems (data, callback_wf1b, bucket, identifier) ; }, // From full details, get all individual elements to download
								function (results, callbacks_wf1c) { wf1_ReadSvfF2dManifest (results, callbacks_wf1c, bucket, identifier) ; }, // .svf/.f2d/manifest additional references to download/create
								function (uris, callback_wf1d) { wf1_GetAdditionalItems (uris, callback_wf1d, bucket, identifier) ; }, // Get additional items from the previous extraction step
								function (refs, callback_wf1e) { wf1_GenerateLocalHtml (refs, callback_wf1e, bucket, identifier) ; }, // Generate helper html/bat
								function (refs, callback_wf1f) { wf1_AddViewerFiles (refs, callback_wf1f, bucket, identifier) ; } // Add the Forge Viewer files
							],
							function (err, results) { wf1End_PackItems (err, results, identifier) ; } // Create a ZIP file and return all elements
					) ;
				}) ;
			} catch ( err ) {
				fs.unlink (__dirname + '/../data/' + identifier + '.lock', function (err) {}) ;
				console.log ('router.get (/results/:identifier/project) exception ' + err) ;
			}
		}) ;
	}) ;
	res.end () ;
}) ;

// Progress helper
var ExtractorProgressMgr =function () {
	this.projects ={} ;

	this.progress =function (identifier) {
		if ( this.projects.hasOwnProperty (identifier) && typeof this.projects [identifier] === 'string' )
			return (this.projects [identifier]) ;
		if ( fs.existsSync (__dirname + '/../www/extracted/' + identifier + '.zip') )
			return (100) ;
		if ( !this.projects.hasOwnProperty (identifier) )
			return (0) ;
		this._dlProgress (identifier) ;
		return (this.projects [identifier].pct) ;
	} ;

	this.dlProgressIntermediate =function (identifier, item) {
		if ( !this.projects.hasOwnProperty (identifier) )
			this.projects [identifier] ={ pct: 0, children: [], factor: 0.5 } ;
		this.projects [identifier].children =this.projects [identifier].children.filter (function (elt/*, index*/) { return (elt.urn != item.urn) ; }) ;
		this.projects [identifier].children.push (item) ;
		//this._dlProgress (identifier) ;
	} ;

	this.dlProgressFull =function (identifier, items) {
		if ( !this.projects.hasOwnProperty (identifier) )
			this.projects [identifier] ={ pct: 0, children: [], factor: 0.5 } ;
		this.projects [identifier].children =items ;
		//this._dlProgress (identifier) ;
	} ;

	this.setFactor =function (factor) {
		factor =factor || 1.0 ;
		this.factor =factor ;
	} ;

	this.setError =function (identifier, err) {
		this.projects [identifier] =err ;
	} ;

	this._dlProgress =function (identifier) {
		if ( !this.projects.hasOwnProperty (identifier) )
			return (0) ;
		var items =this.projects [identifier].children ;
		var ret =items.reduce (
			function (previousValue, currentValue/*, currentIndex, array*/) {
				if ( currentValue.dl !== undefined && currentValue.size === _default_size_ )
					currentValue.size =currentValue.dl ;
				previousValue.size +=(currentValue.size !== undefined ? currentValue.size : 0) ;
				previousValue.dl +=(currentValue.dl !== undefined ? currentValue.dl : 0) ;
				return (previousValue) ;
			},
			{ size: 0, dl: 0 }
		) ;
		var pct =Math.floor (this.projects [identifier].factor * 100 * ret.dl / ret.size) ;
		//console.log ('progress(' + identifier + '): ' + ret.dl + ' / ' + ret.size + ' = ' + pct + '%') ;
		this.projects [identifier].pct =pct ;
		return (pct) ;
	} ;

	this.release =function (identifier) {
		if ( this.projects.hasOwnProperty (identifier) )
			delete this.projects [identifier] ;
	} ;

} ;
var extractorProgressMgr =new ExtractorProgressMgr () ;

// Get the bucket/identifier viewable data creation progress
router.get ('/results/:identifier/project/progress', function (req, res) {
	//var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	res.json ({ progress: extractorProgressMgr.progress (identifier) }) ;
}) ;

// Get latest full details
function wf1_GetFullDetails (callback_wf1a, bucket, identifier, urn) {
	console.log ('#1 - Getting full viewable information') ;
	new lmv.Lmv (bucket).all (urn)
		.on ('success', function (data) {
			if ( data.progress == 'complete' )
				fs.writeFile (__dirname + '/../data/' + identifier + '.resultdb.json', JSON.stringify (data), function (err) {}) ;
			callback_wf1a (null, data) ;
		})
		.on ('fail', function (err) {
			callback_wf1a (err, null) ;
		})
	;
}

// From full details, get all individual elements to download
function wf1_GetItems (data, callback_wf1b, bucket, identifier) {
	console.log ('#2a - Filtering objects') ;
	// Collect Urns to extract from the server
	var items =loop4Urns (data) ;
	items =items.filter (function (item) { return (item.urn !== undefined && item.urn.indexOf ('urn:adsk.viewing:fs.file:') != -1) ; }) ;

	// Collect Views to create from the viewables
	var views =loop4Views (data, data, identifier) ;
	items =items.concat (views) ;

	// Add manifest & metadata files for f2d file
	console.log ('#2b - Adding manifest & metadata files for any .f2d files') ;
	for ( var i =0 ; i < items.length ; i++ ) {
		if ( items [i].urn !== undefined && path.extname (items [i].urn) == '.f2d' ) {
			items.push ({ urn: path.dirname (items [i].urn) + '/manifest.json.gz', size: 500 }) ;
			items.push ({ urn: path.dirname (items [i].urn) + '/metadata.json.gz', size: 1000 }) ;
			//items.push ({ urn: path.dirname (items [i].urn) + '/objects_attrs.json.gz', size: 5000 }) ;
			//items.push ({ urn: path.dirname (items [i].urn) + '/objects_attrs.json', size: 5000 }) ;
		}
	}
	extractorProgressMgr.dlProgressFull (identifier, items) ;

	console.log ('#2c - Downloading each item') ;
	async.mapLimit (items, 10, // Let's have 10 workers only to limit lose of references (too many for the Autodesk server ;)
		function (item, callback_map1) { // Each tasks execution
			if ( item.urn === undefined ) {
				callback_map1 (null, item) ;
				return ;
			}
			DownloadUrnAndSaveItemToDisk (callback_map1, bucket, identifier, item) ;
		},
		function (err, results) { //- All tasks are done
			if ( err !== undefined && err !== null ) {
				console.log ('Something wrong happened during download') ;
				callback_wf1b (err, null) ;
				return ;
			}
			extractorProgressMgr.dlProgressFull (identifier, results) ;
			callback_wf1b (null, results) ;
		}
	) ;
}

function loop4Urns (doc) {
	var data =[] ;
	if ( doc.urn !== undefined )
		data.push ({
			'urn': doc.urn,
			'size': (doc.size !== undefined ? parseInt (doc.size) : _default_size_)
		}) ;
	if ( doc.children !== undefined ) {
		for ( var i in doc.children )
			data =data.concat (loop4Urns (doc.children [i])) ;
	}
	return (data) ;
}

function loop4Views (doc, parentNode, identifier) {
	var data =[] ;
	if (   doc.urn !== undefined
			&& (path.extname (doc.urn) === '.svf' || path.extname (doc.urn) === '.f2d')
	) {
		var fullpath =doc.urn.substring (doc.urn.indexOf ('/output/') + 8) ;
		data.push ({
			'path': fullpath,
			'name': parentNode.name,
			'size': (doc.size !== undefined ? parseInt (doc.size) : _default_size_)
		}) ;
	}
	if ( doc.children !== undefined ) {
		for ( var i in doc.children )
			data =data.concat (loop4Views (doc.children [i], doc, identifier)) ;
	}
	return (data) ;
}

function DownloadUrnAndSaveItemToDisk (callback_mapx, bucket, identifier, item) {
	try {
		var urn =item.urn ;
		new lmv.Lmv (bucket).downloadItem (urn)
			.on ('success', function (data) {
				//var filename =item.split ('/').pop () ;
				//var filename =path.basename (urn) ;
				var fullpath =__dirname + '/../data/' + identifier + '/' + urn.substring (urn.indexOf ('/output/') + 8) ;
				var filepath =path.dirname (fullpath) ;
				try {
					mkdirp (filepath, function (err) {
						if ( err )
							throw err ;
						extractorProgressMgr.dlProgressIntermediate (
							identifier,
							{ urn: urn, name: fullpath.substring (5), size: data.length, dl: data.length }
						) ;
						fs.writeFile (fullpath, data, function (err) {
							callback_mapx (null, { urn: urn, name: fullpath.substring (5), size: data.length, dl: data.length }) ;
						}) ;
					}) ;
				} catch ( err ) {
					console.log ('DownloadUrnAndSaveItemToDisk exception ' + err) ;
					console.log ('Save to disk failed for ' + urn) ;
					callback_mapx (err, null) ;
				}
			})
			.on ('fail', function (err) {
				if ( err == 404 || err == 504 ) {
					console.log ('Warning(' + err + ') - ' + urn + ' <ignoring>') ;
					var fullpath =__dirname + '/../data/' + identifier + '/' + urn.substring (urn.indexOf ('/output/') + 8) ;
					callback_mapx (null, { urn: urn, name: fullpath.substring (5), size: item.size, error: err }) ;
					return ;
				}
				console.log ('Error(' + err + ') - Download failed for - ' + urn) ;
				callback_mapx (err, null) ;
			})
		;
	} catch ( err ) {
		console.log ('DownloadUrnAndSaveItemToDisk exception - ' + err) ;
	}
}

function DownloadFileAndSaveItemToDisk (callback_mapx, bucket, identifier, item) {
	unirest.get (item)
		.headers ({ 'Authorization': ('Bearer ' + lmv.Lmv.getToken ()) })
		.encoding (null)
		//.timeout (2 * 60 * 1000) // 2 min
		.end (function (response) {
			try {
				//var filename =path.basename (item) ;
				var fullpath =__dirname + '/../data/' + identifier + '/' + item.substring (item.indexOf ('/viewers/') + 9) ;
				var filepath =path.dirname (fullpath) ;

				if ( response.statusCode != 200 ) {
					console.log ('Warning(' + response.statusCode + ') - Download failed for ' + fullpath + ' <ignoring>') ;
					callback_mapx (null, { urn: item, name: fullpath.substring (5), size: 0, dl: 0, error: response.statusCode }) ;
					return ;
				}

				mkdirp (filepath, function (err) {
					if ( err )
						throw err ;
					extractorProgressMgr.dlProgressIntermediate (
							identifier,
							{ urn: item, name: fullpath.substring (5), size: response.raw_body.length, dl: response.raw_body.length }
					) ;
					fs.writeFile (fullpath, response.raw_body, function (err) {
						callback_mapx (null, { urn: item, name: fullpath.substring (5), size: response.raw_body.length, dl: response.raw_body.length }) ;
					}) ;
				}) ;
			} catch ( err ) {
				console.log ('DownloadFileAndSaveItemToDisk exception ' + err) ;
				console.log ('Save to disk failed for ' + item) ;
				callback_mapx (err, null) ;
			}
		})
	;
} ;

// .svf/.f2d/manifest additional references to download/create
function wf1_ReadSvfF2dManifest (results, callbacks_wf1c, bucket, identifier) {
	console.log ('#3 - Reading svf/f2d/manifest information') ;
	// Collect the additional elements
	async.parallel ([
			function (callback_p1a) {
				var svf =filterItems (results, '.*\\.svf$') ;
				async.map (
						svf,
						function (item, callback_map2) { wf1_ReadSvfItem (callback_map2, item, identifier, svf) ; },
						function (err, uris1) {
							if ( err ) {
								callback_p1a (err, null) ;
								return ;
							}
							var out =[] ;
							out =out.concat.apply (out, uris1) ;
							callback_p1a (null, out) ;
						}
				) ;
			},
			function (callback_p1b) {
				var f2d =filterItems (results, '.*\\.f2d$') ;
				async.map (
						f2d,
						function (item, callback_map3) { wf1_ReadF2dItem (callback_map3, item, identifier, f2d) ; },
						function (err, uris2) {
							if ( err ) {
								callback_p1b (err, null) ;
								return ;
							}
							var out =[] ;
							out =out.concat.apply (out, uris2) ;
							callback_p1b (null, out) ;
						}
				) ;
			},
			function (callback_p1c) {
				var manifest =filterItems (results, '.*manifest\\.json\\.gz$') ;
				async.map (
						manifest,
						function (item, callback_map4) { wf1_ReadManifest (callback_map4, item, identifier) ; },
						function (err, uris3) {
							if ( err ) {
								callback_p1c (err, null) ;
								return ;
							}
							var out =[] ;
							out =out.concat.apply (out, uris3) ;
							callback_p1c (null, out) ;
						}
				) ;
			}
		],
		function (err, uris) {
			if ( err ) {
				callbacks_wf1c (err, null) ;
				return ;
			}
			var out =results ;
			out =out.concat.apply (out, uris) ;
			callbacks_wf1c (null, out) ;
		}
	) ;
}

function filterItems (arr, criteria) {
	var filtered =arr.filter (function (obj) { return (new RegExp (criteria).test (obj.name)) ; }) ;
	return (filtered) ;
}

function wf1_ReadSvfItem (callback_map2, item, identifier, svf) {
	var uris =[] ;

	// Generate the document reference for local view html
	//var pathname =item.name ;
	//pathname =pathname.substring (pathname.indexOf ('/') + 1) ;
	//var name =path.basename (item.name) + '-' + svf.indexOf (item) ;
	//uris.push ({ 'path': pathname, 'name': name }) ;

	// Get manifest file
	fs.readFile (__dirname + '/../data/' + item.name, function (err, content) {
		var ozip =new AdmZip (content) ;
		var zipEntries =ozip.getEntries () ;
		zipEntries.forEach (function (zipEntry) {
			if ( !zipEntry.isDirectory ) {
				if ( zipEntry.entryName == 'manifest.json' ) {
					var manifest =JSON.parse (zipEntry.getData ().toString ('utf8')) ;
					uris =uris.concat (loopManifest (manifest, path.dirname (item.urn))) ;
				}
			}
		}) ;

		callback_map2 (null, uris) ;
	}) ;
}

function wf1_ReadF2dItem (callback_map3, item, identifier, f2d) {
	var uris =[] ;

	// Generate the document reference for local view html
	//var pathname =item.name ;
	//pathname =pathname.substring (pathname.indexOf ('/') + 1) ;
	//var name =path.basename (item.name) + '-' + f2d.indexOf (item) ;
	//uris.push ({ 'path': pathname, 'name': name }) ;

	callback_map3 (null, uris) ;
}

function wf1_ReadManifest (callback_map4, item, identifier) {
	fs.readFile (__dirname + '/../data/' + item.name, function (err, content) {
		//var unzipContent =zlib.unzipSync (content).toString ('utf8') ;
		zlib.unzip (content, function (err, unzipContent) {
			var manifest =JSON.parse (unzipContent) ;
			var uris =loopManifest (manifest, path.dirname (item.urn)) ;

			callback_map4 (null, uris) ;
		}) ;
	}) ;
}

function loopManifest (doc, urnParent) {
	var data =[] ;
	if ( doc.URI !== undefined && doc.URI.indexOf ('embed:/') != 0 ) // embed:/ - Resource embedded into the svf file, so just ignore it
		//data.push (urnParent + '/' + doc.URI) ;
		//data.push (path.normalize (urnParent + '/' + doc.URI).split (path.sep).join ('/')) ;
		data.push ({
			'urn': path.normalize (urnParent + '/' + doc.URI).split (path.sep).join ('/'),
			'size': (doc.size !== undefined ? parseInt (doc.size) : _default_size_)
		}) ;
	if ( doc.assets !== undefined ) {
		for ( var i in doc.assets )
			data =data.concat (loopManifest (doc.assets [i], urnParent)) ;
	}
	return (data) ;
}

// Get additional items from the previous extraction step
function wf1_GetAdditionalItems (uris, callback_wf1d, bucket, identifier) {
	// Download the additional elements
	console.log ('#4 - Downloading additional items') ;
	extractorProgressMgr.dlProgressFull (identifier, uris) ;
	extractorProgressMgr.setFactor (1.0) ;
	async.mapLimit (uris, 10, // Let's have 10 workers only to limit lose of references (too many for the Autodesk server ;)
		function (item, callback_map5) { // Each tasks execution
			if ( item.urn === undefined || item.dl !== undefined )
				return (callback_map5 (null, item)) ;
			DownloadUrnAndSaveItemToDisk (callback_map5, bucket, identifier, item) ;
		},
		function (err, results) { // All tasks are done
			if ( err !== undefined && err !== null ) {
				console.log ('Something wrong happened during additional items download') ;
				callback_wf1d (err, null) ;
				return ;
			}
			extractorProgressMgr.dlProgressFull (identifier, results) ;
			callback_wf1d (null, results) ;
		}
	) ;
}

// Generate helper html/bat
function wf1_GenerateLocalHtml (refs, callback_wf1e, bucket, identifier) {
	var doclist =refs.filter (function (obj) { return (obj.hasOwnProperty ('path')) ; }) ;
	doclist =doclist.map (function (obj) { if ( obj.hasOwnProperty ('size') ) delete obj.size ; return (obj) ; }) ;
	refs =refs.filter (function (obj) { return (!obj.hasOwnProperty ('path')) ; }) ;

	fs.createReadStream ('views/go.ejs').pipe (fs.createWriteStream (__dirname + '/../data/' + identifier + '/index.bat')) ;
	refs.push ({ name: identifier + '/index.bat', size: 602, dl: 602 }) ;
	fs.readFile ('views/view.ejs', 'utf-8', function (err, st) {
		if ( err )
			return (callback_wf1e (err, refs)) ;
		var data =ejs.render (st, { docs: doclist }) ;
		var fullnameHtml =identifier + '/index.html' ;
		fs.writeFile (__dirname + '/../data/' + fullnameHtml, data, function (err) {
			if ( err ) {
				callback_wf1e (err, refs) ;
				return ;
			}

			refs.push ({ name: identifier + '/index.html', size: data.length, dl: data.length }) ;
			callback_wf1e (null, refs) ;
		}) ;
	}) ;
}

// Add the Forge Viewer files
function wf1_AddViewerFiles (refs, callback_wf1f, bucket, identifier) {
	console.log ('#5 - Downloading the viewer files') ;
	var urns =viewerFileList.map (function (item) {
		var urn =lmv.Lmv.baseEndPoint () + '/viewingservice/' + lmv.Lmv.version () + '/viewers/' + item ;
		extractorProgressMgr.dlProgressIntermediate (
				identifier,
				{ urn: urn, name: item, size: 20000, dl: 0 }
		) ;
		return (urn) ;
	}) ;
	async.mapLimit (urns, 10, // Let's have 10 workers only to limit lose of references (too many for the Autodesk server ;)
		function (item, callback_map6) { // Each tasks execution
			DownloadFileAndSaveItemToDisk (callback_map6, bucket, identifier, item) ;
		},
		function (err, results) { // All tasks are done
			if ( err !== undefined && err !== null ) {
				console.log ('Something wrong happened during viewer files download') ;
				callback_wf1f (err, null) ;
				return ;
			}
			results =results.concat (refs) ;
			extractorProgressMgr.dlProgressFull (identifier, results) ;
			fs.createReadStream (__dirname + '/../www/bower_components/jquery/dist/jquery.min.js')
				.pipe (fs.createWriteStream (__dirname + '/../data/' + identifier + '/jquery.min.js')) ;
			results.push ({ urn: 'www/bower_components/jquery/dist/jquery.min.js', name: (identifier + '/jquery.min.js'), size: 84380, dl: 84380 }) ;
			fs.createReadStream (__dirname + '/../www/bower_components/jquery-ui/jquery-ui.min.js')
					.pipe (fs.createWriteStream (__dirname + '/../data/' + identifier + '/jquery-ui.min.js')) ;
			results.push ({ urn: 'www/bower_components/jquery-ui/jquery-ui.min.js', name: (identifier + '/jquery-ui.min.js'), size: 240427, dl: 240427 }) ;
			callback_wf1f (null, results) ;
		}
	) ;
}

// Create a ZIP file and return all elements
function wf1End_PackItems (err, results, identifier) {
	if ( err ) {
		console.log ('Error while downloading fragments! ZIP not created.') ;
		wf1End_Cleanup (identifier, false) ;
		return ;
	}
	// We got all d/l
	try {
		// We are done! Create a ZIP file
		var archive =archiver ('zip') ;
		archive.on ('error', function (err) {
			console.log ('PackItems: ' + err)
		}) ;
		archive.on ('finish', function (err) {
			wf1End_Cleanup (identifier, err === undefined) ;
			console.log ('PackItems ended successfully.') ;
		}) ;

		//var output =fs.createWriteStream (__dirname + '/../data/' + identifier + '/' + identifier + '.zip') ;
		var output =fs.createWriteStream (__dirname + '/../www/extracted/' + identifier + '.zip') ;
		archive.pipe (output) ;

		var merged =[] ;
		merged =merged.concat.apply (merged, results) ;
		for ( var i =0 ; i < merged.length ; i++ ) {
			if ( !merged [i].hasOwnProperty ('error') )
			//archive.append (merged [i].content, { name: merged [i].name }) ;
			//archive.append (fs.createReadStream (__dirname + '/../data/' + merged [i].name), { name: merged [i].name }) ;
				archive.file (__dirname + '/../data/' + merged [i].name, { name: merged [i].name }) ;
		}
		archive.finalize () ;
	} catch ( err ) {
		console.log ('wf1End_PackItems exception') ;
		wf1End_Cleanup (identifier, false) ;
	}
}

function wf1End_Cleanup (identifier, bSuccess) {
	bSuccess =bSuccess || false ;
	if ( bSuccess ) {
		fs.readFile (__dirname + '/../data/' + identifier + '.lock', 'utf-8', function (err, data) {
			if ( err )
				return ;
			data =JSON.parse (data) ;
			if ( data.length )
				wf1End_Notify (identifier, data)
			fs.unlink (__dirname + '/../data/' + identifier + '.lock', function (err) {}) ;
		}) ;
	} else {
		wf1End_NotifyError (identifier) ;
		fs.unlink (__dirname + '/../data/' + identifier + '.lock', function (err) {}) ;
	}
	extractorProgressMgr.release (identifier) ;
	rimraf (__dirname + '/../data/' + identifier, function (err) {}) ; // Cleanup
}

function wf1End_Notify (identifier, tos) {
	fs.readFile ('views/email.ejs', 'utf-8', function (err, st) {
		if ( err )
			return ;
		var obj ={ ID: identifier } ;
		var data =ejs.render (st, obj) ;
		for ( var i =0 ; i < tos.length ; i++ ) {
			sendMail ({
				'from': 'ADN Sparks <adn.sparks@autodesk.com>',
				'replyTo': 'adn.sparks@autodesk.com',
				'to': tos [i],
				'subject': 'Autodesk Forge Viewer Extractor notification',
				'html': data,
				'forceEmbeddedImages': true
			}) ;
		}
	}) ;
}

function wf1End_NotifyError (identifier) {
	fs.readFile ('views/email-extract-failed.ejs', 'utf-8', function (err, st) {
		if ( err )
			return ;
		var obj ={ ID: identifier } ;
		var data =ejs.render (st, obj) ;
		sendMail ({
			'from': 'ADN Sparks <adn.sparks@autodesk.com>',
			'replyTo': 'adn.sparks@autodesk.com',
			//'to': 'adn.sparks@autodesk.com',
			'subject': 'Autodesk Forge Viewer Extraction failed',
			'html': data,
			'forceEmbeddedImages': true
		}) ;
	}) ;
}

// Download a single file from its bucket/identifier/fragment pair
router.get ('/results/file/:identifier/:fragment', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;
	var fragment =req.params.fragment ;

	fs.readFile (__dirname + '/../data/' + identifier + '.resultdb.json', 'utf-8', function (err, data) {
		if ( err )
			return (res.status (404).end ()) ;
		data =JSON.parse (data) ;
		var guid =data.urn ;

		var urn ='urn:adsk.viewing:fs.file:' + guid + '/output/' + fragment ;
		new lmv.Lmv (bucket).downloadItem (urn)
			.on ('success', function (data) {
				res.setHeader ('Content-Type', 'application/octet-stream') ;
				res.attachment (path.basename (fragment)) ;
				res.end (data, 'binary') ;
			})
			.on ('fail', function (err) {
				res.status (404).end () ;
			})
		;
	}) ;
}) ;

module.exports =router ;

Array.prototype.unique =function () {
	var a =this.concat () ;
	for ( var i =0 ; i < a.length ; i++ ) {
		for ( var j =i + 1 ; j < a.length ; j++ ) {
			if ( a [i] === a [j] )
				a.splice (j--, 1) ;
		}
	}
	return (a) ;
} ;
