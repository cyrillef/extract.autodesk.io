//
// Copyright (c) Autodesk, Inc. All rights reserved
//
// Forge Extractor
// by Cyrille Fauvel - Autodesk Developer Network (ADN)
// November 2016
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
var zip =require ('node-zip') ;
var fs =require ('fs') ;
var zlib =require ('zlib') ;
var mkdirp =require ('mkdirp') ;
var path =require ('path') ;
var ForgeSDK =require ('forge-apis') ;
var config =require ('./config') ;
var forgeToken =require ('./forge-token') ;
//var utils =require ('./utils') ;

function bubble (progress) {
	this._outPath ='./' ;
	this._progress =progress ;
	//this._filesToFetch =0 ;
	//this._estimatedSize =0 ;
	//this._progress =0 ;
	this._viewables =[] ; // { path: '', name: '' }
	this._errors =[] ; // ''

	this.downloadBubble =function (urn, outPath) {
		var self =this ;
		self._outPath =outPath ;
		return (new Promise (function (fulfill, reject) {
			self._progress.msg ='Downloading manifest' ;
			self.getManifest (urn)
				.then (function (bubble) {
					//utils.writeFile (outPath + 'bubble.json', bubble) ;
					self._progress.msg ='Listing all derivative files' ;
					self.listAllDerivativeFiles (bubble.body, function (error, result) {
						self._progress._filesToFetch =result.list.length ;
						console.log ('Number of files to fetch:', self._progress._filesToFetch) ;
						self._progress._estimatedSize =0 | (result.totalSize / (1024 * 1024)) ;
						console.log ('Estimated download size:', self._progress._estimatedSize, 'MB') ;

						//self.fixFlatBubbles (result) ;
						//self.fixFusionBubbles (result) ;

						self._progress.msg ='Downloading derivative files' ;
						self.downloadAllDerivativeFiles (result.list, self._outPath, function (failed, succeeded) {
							//if ( ++self._done == 1 /*2*/ )
							//	return ;
							self.failed =failed ;
							self.succeeded =succeeded ;
							fulfill (self) ;
						}) ;
					}) ;
				})
				.catch (function (err) {
					console.error ('Error:', err.message) ;
					self._errors.push (err.message) ;
					reject (self) ;
				})
			;
		})) ;
	} ;

	this.listAllDerivativeFiles =function (bubble, callback) {
		var self =this ;
		// First get all the root derivative files from the bubble
		var res =[] ;
		(function traverse (node, parent) {
			if (   node.role === 'Autodesk.CloudPlatform.PropertyDatabase'
				|| node.role === 'Autodesk.CloudPlatform.DesignDescription'
				|| node.role === 'Autodesk.CloudPlatform.IndexableContent'
				|| node.role === 'graphics'
				|| node.role === 'raas'
				|| node.role === 'pdf'
				|| node.role === 'leaflet-zip'
				|| node.role === 'preview'
				|| node.role === 'lod'
			) {
				var item ={ mime: node.mime } ;
				self.extractPathsFromGraphicsUrn (node.urn, item) ;
			//	if ( item.localPath === '' )
			//		item.localPath =parent.guid + '/' ;
				// Optionally replace the path in the source bubble by the local path
				// for use as local bubbles in the viewer
				node.urn ='$file$/' + item.localPath + item.rootFileName ;
				res.push (item) ;
				if (   node.mime == 'application/autodesk-svf'
					|| node.mime == 'application/autodesk-f2d'
				) {
					item.name =node.name =parent.name ;
					if ( parent.hasThumbnail === 'true' ) {
						var thumbnailItem ={ mime: 'thumbnail', urn: bubble.urn, guid: parent.guid,
							localPath: item.localPath,
							thumbnailUrn: '$file$/thumbnails/' + parent.guid + '.png',
							rootFileName: (item.rootFileName + '.png')
						} ;
						res.push (thumbnailItem) ;
					}
				}
			}
			if ( node.type === 'geometry' ) {
				// Why would we be sane and use real booleans??
				//if ( node.hasThumbnail === 'true' ) {
				//	var item ={ mime: 'thumbnail', urn: bubble.urn, guid: node.guid } ;
				//	if ( node.guid.substring (0, 1) === '{' ) {
				//		try {
				//			var guidObject =JSON.parse (node.guid) ;
				//			node.assetguid =guidObject.asset ;
				//			item.assetguid =guidObject.asset ;
				//		} catch ( ex ) {
				//		}
				//	}
				//	item.localPath ='/' ;
				//	node.thumbnailUrn ='$file$/thumbnails/' + item.guid + '.png' ;
				//	res.push (item) ;
				//}
				if ( node.intermediateFile && node.children ) {
					// We will derive the full intermediate file path from the child F2D node
					var f2dNode ;
					for ( var i =0 ; i<node.children.length ; i++) {
						if ( node.children [i].mime === 'application/autodesk-f2d' ) {
							f2dNode =node.children [i] ;
							break ;
						}
					}
					if ( f2dNode ) {
						var f2dUrl =f2dNode.urn ;
						var idx =f2dUrl.indexOf (bubble.urn) ;
						var baseUrl =f2dUrl.substr (0, idx + bubble.urn.length) ;
						var item ={ mime: 'application/octet-stream', urn: bubble.urn, guid: node.guid } ;
						// Construct the full urn path, similar to how it's stored for the SVF geometry items
						var intPath ='/' + node.intermediateFile ;
						if ( baseUrl.indexOf ('urn:adsk.objects') === 0 )
							intPath =encodeURIComponent (intPath) ;
						var fullPath =baseUrl + intPath ;
						self.extractPathsFromGraphicsUrn (fullPath, item) ;
						res.push (item) ;
					}
				}
			}
			if ( node.children ) {
				node.children.forEach (function (child) {
					traverse (child, node) ;
				}) ;
			}
		}) (bubble, null) ;

		console.log ('Manifests to process: ', res.length) ;
		if ( res.length === 0 )
			return (callback (null, { list: [], totalSize: 0 })) ;

		var current =0 ;
		var done =0 ;
		var estSize =0 ;
		var countedPropDb ={} ;

		var processOne =function () {
			function onProgress () {
				done++ ;
				console.log ('Manifests done ', done) ;
				if ( done === res.length ) {
					var result ={
						list: res,
						totalSize: estSize
					} ;
					callback (null, result) ;
				} else {
					setTimeout (processOne, 0) ;
				}
			}

			if ( current >= res.length )
				return ;
			var rootItem =res [current++] ;
			var basePath ;
			var files =rootItem.files =[] ;
			if ( rootItem.mime !== 'thumbnail' )
				basePath =rootItem.basePath ;
			if ( rootItem.mime === 'application/autodesk-db' ) {
				// The file list for property database files is fixed,
				// no need to go to the server to find out
				files.push ('objects_attrs.json.gz') ;
				files.push ('objects_vals.json.gz') ;
				files.push ('objects_avs.json.gz') ;
				files.push ('objects_offs.json.gz' );
				files.push ('objects_ids.json.gz') ;
				// f2d will reference us, but not the svf :( - add ourself here
				files.push (rootItem.rootFileName) ;
				onProgress () ;
			} else if ( rootItem.mime === 'thumbnail' ) {
				//rootItem.files.push ((rootItem.assetguid || rootItem.guid) + '.png') ;
				rootItem.files.push (rootItem.rootFileName) ;
				onProgress () ;
			} else if ( rootItem.mime === 'application/autodesk-svf' ) {
				var svfPath =rootItem.urn.slice (basePath.length) ;
				files.push (svfPath) ;
				// Closure to capture loop-variant variable for the getItem callback
				(function () {
					var myItem =rootItem ;
					self.getItem (rootItem.urn, null, function (error, success) {
						if ( error )
							self._errors.push ('Failed to download ' + myItem.urn) ;
						if ( success ) {
							var manifest ;
							try {
								var pack =new zip (success, { base64: false, checkCRC32: true }) ;
								success =pack.files ['manifest.json'].asNodeBuffer () ;
								manifest =JSON.parse (success.toString ('utf8')) ;
							} catch ( e ) {
								console.error ('Error:', e.message) ;
								self._errors.push (e.message) ;
							}
							if ( manifest && manifest.assets ) {
								for ( var j =0 ; j < manifest.assets.length ; j++ ) {
									var asset =manifest.assets [j] ;
									// Skip SVF embedded resources
									if ( asset.URI.indexOf ('embed:/') === 0 )
										continue ;
									// Skip non-local property db files
									// Those are listed explicitly in the bubble as property database role
									// so we will get them anyway
									if ( asset.URI.indexOf ('../') === 0 ) {
										// To get a correct bubble size estimate,
										// we get the property db file sizes from the SVF manifest,
										// because they are not available in the bubble itself.
										// It's ugly, but such is bubble life.
										// Also, this number seems to be the uncompressed size of the property db files,
										// so it's an overestimate, and we divide by 4 to get a more reasonable one.
										if ( !countedPropDb [rootItem.basePath] )
											estSize +=asset.size / 4 ;
										continue ;
									}
									estSize +=asset.size ;
									myItem.files.push (asset.URI) ;
								}
							}
							countedPropDb [rootItem.basePath] =1 ;
						}
						onProgress () ;
					}) ;
				}) () ;
			} else if ( rootItem.mime === 'application/autodesk-f2d' ) {
				files.push ('manifest.json.gz') ;
				var manifestPath =basePath + 'manifest.json.gz' ;
				// Closure to capture loop-variant variable for the getItem callback
				(function () {
					var myItem =rootItem ;
					self.getItem (manifestPath, null, function (error, success) {
						if ( error )
							self._errors.push ('Failed to download ' + myItem.urn) ;
						if ( success ) {
							estSize +=success.length ;
							var manifest ;
							try {
								if (success [0] === 0x1f && success [1] === 0x8b )
									success =zlib.gunzipSync (success) ;
								manifest =JSON.parse (success.toString ('utf8')) ;
							} catch ( e ) {
								console.error ('Error:',  e.message) ;
								self._errors.push (e.message) ;
							}
							if ( manifest && manifest.assets ) {
								for ( var j =0 ; j < manifest.assets.length ; j++ ) {
									var asset =manifest.assets [j] ;
									// Skip non-local property db files
									// Those are listed explicitly in the bubble as property database role
									// so we will get them anyway
									if ( asset.URI.indexOf ('../') === 0 )
										continue ;
									estSize +=asset.size ;
									myItem.files.push (asset.URI) ;
								}
							}
						}
						onProgress () ;
					}) ;
				}) () ;
			} else {
				// All other files are assumed to be just the file listed in the bubble
				files.push (rootItem.rootFileName) ;
				onProgress () ;
			}
		} ;
		// Kick off 6 parallel jobs
		for ( var k =0 ; k < 6 ; k++ )
			processOne () ;
	} ;

	this.downloadAllDerivativeFiles =function (fileList, destDir, callback) {
		var self =this ;
		var succeeded =0 ;
		var failed =0 ;
		var flatList =[] ;
		for ( var i =0 ; i < fileList.length ; i++ ) {
			var item =fileList [i] ;
			for (var j =0 ; j < item.files.length ; j++ ) {
				var flatItem ={
					basePath: item.basePath,
					localPath: destDir + item.localPath,
					fileName: item.files [j]
				} ;
				if ( item.name )
					flatItem.name =item.name ;
				if ( item.urn ) {
					flatItem.urn =item.urn ;
					flatItem.guid =item.guid ;
					flatItem.mime =item.mime ;
				}
				flatList.push (flatItem) ;
			}
		}
		if ( flatList.length === 0 )
			return (callback (failed, succeeded)) ;
		var current =0 ;
		var done =0 ;
		var downloadOneItem =function () {
			if ( current >= flatList.length )
				return ;
			var fi =flatList [current++] ;
			var downloadComplete =function (error, success) {
				done++ ;
				if ( error ) {
					failed++ ;
					console.error ('Failed to download file:', fi.localPath + fi.fileName, error) ;
					self._errors.push ('Failed to download file: ' + fi.localPath + fi.fileName) ;
				} else {
					succeeded++ ;
					console.log ('Downloaded:', fi.localPath + fi.fileName) ;
				}
				self._progress._progress =(100 * (failed + succeeded) / flatList.length) | 0 ;
				console.log ('Progress:', self._progress._progress, '%') ;
				if ( done === flatList.length )
					callback (failed, succeeded) ;
				else
					setTimeout (downloadOneItem, 0) ;
			} ;
			if ( fi.mime && fi.mime === 'thumbnail' )
				self.getThumbnail (fi.urn, fi.guid, 400, fi.localPath + fi.fileName, downloadComplete) ;
			else
				self.getItem (fi.basePath + fi.fileName, fi.localPath + fi.fileName, downloadComplete) ;
			if (   (   fi.mime == 'application/autodesk-svf'
					|| fi.mime == 'application/autodesk-f2d')
				&& (   path.extname (fi.fileName).toLowerCase () == '.svf'
					|| path.extname (fi.fileName).toLowerCase () == '.f2d')
			)
				self._viewables.push ({ path: ('./' + fi.localPath.substring (self._outPath.length) + fi.fileName), name: fi.name }) ;
		} ;
		// Kick off 10 parallel jobs
		for ( var k =0 ; k < 10 ; k++ )
			downloadOneItem () ;
	} ;

	this.extractPathsFromGraphicsUrn =function (urn, result) {
		// This needs to be done for encoded OSS URNs, because the paths
		// in there are url encoded and lose the / character.
		urn =decodeURIComponent (urn) ;
		var basePath =urn.slice (0, urn.lastIndexOf ('/') + 1) ;
		var localPath =basePath.slice (basePath.indexOf ('/') + 1) ;
		var urnBase =basePath.slice (0, basePath.indexOf ('/')) ;
		localPath =localPath.replace (/^output\//, '') ;
		// For supporting compound bubbles, we need to prefix
		// by sub-urn as well, otherwise files might clash.
		// var localPrefix = urnBase ? crypto.createHash('md5').update(urnBase).digest("hex") + "/" : "";
		var localPrefix ='' ;
		result.urn =urn ;
		result.basePath =basePath ;
		result.localPath =localPrefix + localPath ;
		result.rootFileName =urn.slice (urn.lastIndexOf ('/') + 1) ;
	} ;

	this.getManifest =function (urn) {
		// Verify the required parameter 'urn' is set
		if ( urn == undefined || urn == null )
			return (Promise.reject ("Missing the required parameter 'urn' when calling getManifest")) ;
		var ModelDerivative =new ForgeSDK.DerivativesApi () ;
		return (ModelDerivative.apiClient.callApi (
			'/derivativeservice/v2/manifest/{urn}', 'GET',
			{ 'urn': urn }, {}, { /*'Accept-Encoding': 'gzip, deflate'*/ },
			{}, null,
			[], [ 'application/vnd.api+json', 'application/json' ], null,
			forgeToken.RW, forgeToken.RW.getCredentials ()
		)) ;
	} ;

	this.downloadItem =function (urn) {
		// Verify the required parameter 'urn' is set
		if ( urn == undefined || urn == null )
			return (Promise.reject ("Missing the required parameter 'urn' when calling downloadItem")) ;
		var ModelDerivative =new ForgeSDK.DerivativesApi () ;
		return (ModelDerivative.apiClient.callApi (
			'/derivativeservice/v2/derivatives/{urn}', 'GET',
			{ 'urn': urn }, {}, { 'Accept-Encoding': 'gzip, deflate' },
			{}, null,
			[], [], null,
			forgeToken.RW, forgeToken.RW.getCredentials ()
		)) ;
	} ;

	this.openWriteStream =function (outFile) {
		var wstream ;
		if ( outFile ) {
			try {
				mkdirp.sync (path.dirname (outFile)) ;
				wstream =fs.createWriteStream (outFile) ;
			} catch ( e ) {
				console.error ('Error:', e.message) ;
			}
		}
		return (wstream) ;
	} ;

	this.getItem =function (itemUrn, outFile, callback) {
		var self =this ;
		//console.log ('-> ' + itemUrn) ;
		this.downloadItem (itemUrn)
			.then (function (response) {
				if ( response.statusCode !== 200 )
					return (callback (response.statusCode)) ;
				// Skip unzipping of items to make the downloaded content compatible with viewer debugging
				var wstream =self.openWriteStream (outFile) ;
				if ( wstream ) {
					wstream.write (typeof response.body == 'object' && path.extname (outFile) === '.json' ? JSON.stringify (response.body) : response.body) ;
					wstream.end () ;
					callback (null, response.statusCode) ;
				} else {
					callback (null, response.body) ;
				}
			})
			.catch (function (error) {
				console.error ('Error:', error.message) ;
				self._errors.push ('Error: ' + error.message) ;
				callback (error, null) ;
			})
			//.pipe (wstream)
		;
	} ;

	this.getThumbnail =function (urn, guid, sz, outFile, callback) {
		var self =this ;
		var ModelDerivative =new ForgeSDK.DerivativesApi () ;
		//console.log ('Thumbnail URN: ', urn, 'GUID: ', guid) ;
		//ModelDerivative.getThumbnail (urn, { width: sz, height: sz }, forgeToken.RW, forgeToken.RW.getCredentials ())
		//	.then (function (thumbnail) {
		//		//fs.writeFile (outFile, thumbnail.body) ;
		//		var wstream =self.openWriteStream (outFile) ;
		//		if ( wstream ) {
		//			wstream.write (thumbnail.body) ;
		//			wstream.end () ;
		//			callback (null, thumbnail.statusCode) ;
		//		} else {
		//			callback (null, thumbnail.body) ;
		//		}
		//	})
		//	.catch (function (error) {
		//		console.error ('Error:', error.message) ;
		//		self._errors.push ('Error: ' + error.message) ;
		//		callback (error, null) ;
		//	})
		//;
		if ( urn == undefined || urn == null )
			return (Promise.reject ("Missing the required parameter 'urn' when calling getThumbnail")) ;
		var queryParams ={ width: sz, height: sz, role: 'rendered' } ;
		if ( guid )
			queryParams.guid =guid ;
		var ModelDerivative =new ForgeSDK.DerivativesApi () ;
		ModelDerivative.apiClient.callApi (
			'/derivativeservice/v2/thumbnails/{urn}', 'GET',
			{ 'urn': urn }, queryParams, {},
			{}, null,
			[], [ 'application/octet-stream' ], null,
			forgeToken.RW, forgeToken.RW.getCredentials ()
		)
			.then (function (thumbnail) {
				//fs.writeFile (outFile, thumbnail.body) ;
				var wstream =self.openWriteStream (outFile) ;
				if ( wstream ) {
					wstream.write (thumbnail.body) ;
					wstream.end () ;
					callback (null, thumbnail.statusCode) ;
				} else {
					callback (null, thumbnail.body) ;
				}
			})
			.catch (function (error) {
				console.error ('Error:', error.message) ;
				self._errors.push ('Error: ' + error.message) ;
				callback (error, null) ;
			})
		;
	} ;

	//this.fixFlatBubbles =function (result) {
	//	// Trying to fix paths without breaking ones which are already good
	//	// We're lucky that our array is sorted by viewables
	//	var guid ='f0224dd3-8767-45c1-ff99-5c9c881b9fee' ;
	//	for ( var i =0 ; i < result.list.length ; i++ ) { // Find the first thumbnail guid to start with
	//		if ( result.list [i].mime === 'thumbnail' ) {
	//			guid =result.list [i].guid ;
	//			break ;
	//		}
	//	}
	//	for ( var i =0 ; i < result.list.length ; i++ ) {
	//		var obj =result.list [i] ;
	//		if ( obj.rootFileName === 'designDescription.json' ) {
	//			// Do nothing
	//		} else if ( obj.mime !== 'thumbnail' ) {
	//			if ( obj.localPath === '' )
	//				obj.localPath =guid + '/' ;
	//		} else { // Switch guid
	//			guid =obj.guid ;
	//		}
	//	}
	//} ;
	//
	//this.fixFusionBubbles =function (result) {
	//	// We're lucky that our array is sorted by viewables
	//	var bFusionFixRequired =false
	//	var guid ='f0224dd3-8767-45c1-ff99-5c9c881b9fee' ;
	//	for ( var i =0 ; i < result.list.length ; i++ ) { // Find the first thumbnail guid to start with
	//		var obj =result.list [i] ;
	//		if ( result.list [i].rootFileName === 'designDescription.json' ) {
	//			// Do nothing
	//		} else if ( obj.mime === 'thumbnail' ) {
	//			guid =obj.assetguid || obj.guid ;
	//			bFusionFixRrequired =obj.assetguid !== undefined ;
	//			break ;
	//		}
	//	}
	//	//if ( !bFusionFixRequired )
	//	//	return ;
	//	for ( var i =0 ; i < result.list.length ; i++ ) {
	//		var obj =result.list [i] ;
	//		if ( obj.mime !== 'thumbnail' ) {
	//			if (    bFusionFixRequired
	//				|| /^[0-9]+\/.*$/.test (obj.localPath)
	//				|| /^(Resource)\/.*$/.test (obj.localPath)
	//			) {
	//				var paths =obj.localPath.split ('/') ;
	//				paths [0] =guid ;
	//				obj.localPath =paths.join ('/') ;
	//			}
	//			//else if ( /^(Resource)\/.*$/.test (obj.localPath) ) {
	//			//	var paths =obj.localPath.split ('/') ;
	//			//	paths.unshift (guid) ;
	//			//	obj.localPath =paths.join ('/') ;
	//			//}
	//		} else { // Switch guid
	//			guid =obj.assetguid || obj.guid ;
	//		}
	//	}
	//} ;

} ;

module.exports =bubble ;
// function Ds(endpoint, auth, oss) {
// bubble-leech / index
