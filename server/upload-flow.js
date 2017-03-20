//
// Copyright (c) Autodesk, Inc. All rights reserved
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
// Forge Extractor
// by Cyrille Fauvel - Autodesk Developer Network (ADN)
//
var express =require ('express') ;
var request =require ('request') ;
var http =require ('http') ;
var https =require ('https') ;
var fs =require ('fs') ;
var bodyParser =require ('body-parser') ;
var AdmZip =require ('adm-zip') ;
var streams =require ('memory-streams') ;
var utils =require ('./utils') ;
var flow =require ('./flow-node.js') () ;
var multer =require ('multer') ;
var storage =multer.memoryStorage () ;
var upload =multer ({ storage: storage }) ;

var ForgeSDK =require ('forge-apis') ;
var config =require ('./config') ;
var forgeToken =require ('./forge-token') ;

var router =express.Router () ;

router.post ('/file', upload.single ('file'), function (req, res) {
	flow.post (req, function (status, filename, original_filename, identifier, totalSize, entries, response) {
		console.log ('POST', status, original_filename, identifier, totalSize) ;
		if ( status == 'done' ) {
			//console.log ('POST', status, original_filename, identifier, totalSize) ;
			var data =response ;
			data.key =identifier ;
			data.name =original_filename ;
			data.bytesRead =totalSize ;
			data.bytesPosted =totalSize ;

			if ( entries !== undefined && entries.length > 0 )
				data.entries =entries ;
			utils.writeFile (utils.data (identifier), data) ;
			res.json (data) ;
			return ;
		}
		res.status (200).end () ;
	}) ;
}) ;

router.options ('/file', function (req, res) {
	res.status (200).send () ;
}) ;

// Handle status checks on chunks through Flow.js
router.get ('/file', function (req, res) {
	flow.get (req, function (status, original_filename, identifier, totalSize) {
		console.log ('GET', status) ;
		res.status (status == 'found' ? 200 : 404).send () ; //- 404 Not Found
	}) ;
}) ;

router.get ('/file/*/details', function (req, res) {
	var identifier =req.url.split ('/') [2] ;
	fs.readFile (utils.data (identifier), function (err, data) {
		if ( err )
			return (res.status (404).send ()) ; //- 404 Not Found
		data =JSON.parse (data) ;
		res.json (data) ;
	}) ;
}) ;

router.get ('/file/*', function (req, res) {
	var identifier =req.url.split ('/') [2] ;
	fs.readFile (utils.data (identifier), function (err, data) {
		if ( err )
			return (res.status (404).end ()) ;
		data =JSON.parse (data) ;

		var ObjectsApi =new ForgeSDK.ObjectsApi () ;
		ObjectsApi.getObject (config.bucket, data.name, {}, forgeToken.RW, forgeToken.RW.getCredentials ())
			.then (function (response) {
				//res.download (serverFile, data.name) ;
				res.writeHead (200, {
					'Content-Type': 'application/octet-stream',
					'Content-disposition': 'attachment;filename=' + data.name,
					'Content-Length': response.body.length
				}) ;
				res.end (response.body) ;
			})
			.catch (function (error) {
				console.error (error) ;
				res.status (404).end () ; //- 404 Not Found
			}) ;
	}) ;
}) ;

// http://murmuring-woodland-5218.herokuapp.com/samples/Seat.dwf (fails)
// http://dwf.blogs.com/residential/VizProject3d.DWF (succeed, but no head content-length)
// https://raw.githubusercontent.com/cyrillef/extract.autodesk.io/master/samples/Au.obj
// https://raw.githubusercontent.com/cyrillef/extract.autodesk.io/master/samples/Au.zip

var chunkJobs ={

	inc: function (identifier) {
		if ( !this.hasOwnProperty (identifier) )
			this [identifier] =0 ;
		this [identifier]++ ;
	},

	dec: function (identifier) {
		if ( !this.hasOwnProperty (identifier) )
			return ;
		this [identifier]-- ;
		if ( this [identifier] === 0 )
			delete this [identifier] ;
	},

	done: function (identifier) {
		return (!this.hasOwnProperty (identifier)) ;
	},

	clean: function (identifier) {
		if ( this.hasOwnProperty (identifier) )
			delete this [identifier] ;
	}

} ;

router.post ('/uri', bodyParser.json (), function (req, res) {
	var uri =req.body.uri ;
	var identifier =req.body.identifier ;
	var original_filename =req.body.name || decodeURIComponent (uri).replace (/[\?#].*$/, "").replace (/.*\//, "") ;
	request.head (uri, function (err, headRes, body) {
		if ( err )
			return (res.status (headRes.statusCode).end (headRes.statusMessage)) ;
		if ( headRes.statusCode != 200 )
			return (res.status (headRes.statusCode).end (headRes.statusMessage)) ;
		var data ={
			'key': identifier,
			'name': original_filename,
			'uri': uri,
			'sessionId': /*identifier +*/ utils.symbol (),
			'size': headRes.headers ['content-length'] || -1,
			'bytesRead': 0,
			'bytesPosted': 0
		} ;
		utils.writeFile (utils.data (identifier), data)
			.then (function (content) {
				var _http =http ;
				if ( /^https:\/\/.*/gi.test (uri) )
					_http =https ;
				var writer =new streams.WritableStream () ;
				var r_ =_http.get (uri, function (res) {
					//res.pipe (writer) ; // memory_streams is buggy with pipe()
					res.on ('data', function (chunk) {
						data.bytesRead +=chunk.length ;
						writer.write (chunk) ;
						//utils.writeFile (utils.data (identifier), data) ;
						fs.writeFileSync (utils.data (identifier), JSON.stringify (data)) ;
						if ( isChunkSizeReached (data) )
							saveChunk (identifier, data, writer) ;
					}) ;
					res.on ('end', function() { // 'close'
						postClosing (identifier, data, writer) ;
					}) ;
				}) ;
				r_.on ('error', function (e) {
					console.error (e)
					utils.unlink (utils.data (identifier)) ;
				}) ;

				res.json ({ uniqueIdentifier: identifier }) ;
			})
			.catch (function (err) {
				console.error (err) ;
				res.status (500).end () ;
			}) ;
	}) ;
}) ;

function isChunkSizeReached (data) {
	// To save as chunk, we need to know the size, and that the file is above 2Mb
	return (   data.size !== -1 && data.size > config.chunkSizeLimit
			&& (data.bytesRead - data.bytesPosted) > config.chunkSizeLimit) ;
}

function saveChunk (identifier, data, writer) {
	var start =data.bytesPosted ;
	//var end =data.bytesRead - 1 ;
	var end =Math.min (start + config.chunkSizeLimit, data.bytesRead) - 1
	var contentRange ='bytes ' + start + '-' + end + '/' + data.size ;
	//data.bytesPosted =data.bytesRead ;
	data.bytesPosted =end + 1 ;
	chunkJobs.inc (identifier) ;
	resumableToOSS (identifier, data.name, writer.toBuffer ().slice (start, end + 1), contentRange, data.sessionId)
		.then (function (response) {
			chunkJobs.dec (identifier) ;
			return (saveManifestAndProgress (response, data)) ;
		})
		.catch (function (error) {
			console.error (error) ;
		}) ;
}

function saveManifestAndProgress (response, data) {
	response.body.key =data.key ;
	response.body.sessionId =data.sessionId ;
	response.uri =data.uri ;
	response.body.size =data.size ;
	response.body.bytesRead =data.bytesRead ;
	response.body.bytesPosted =data.bytesPosted ;
	if ( data.entries !== undefined )
		response.body.entries =data.entries ;
	return (utils.writeFile (utils.data (data.key), response.body)) ;
}

function objectToOSS (identifier, fnname, buffer) {
	return (new Promise (function (fulfill, reject) {
		var ObjectsApi =new ForgeSDK.ObjectsApi () ;
		ObjectsApi.uploadObject (config.bucket, fnname, buffer.length, buffer, {}, forgeToken.RW, forgeToken.RW.getCredentials ())
			.then (function (response) {
				fulfill (response) ;
			})
			.catch (function (error) {
				reject (error) ;
			}) ;
	})) ;
} ;

function resumableToOSS (identifier, fnname, buffer, contentRange, sessionId) {
	//console.log (sessionId, contentRange, buffer.length) ;
	return (new Promise (function (fulfill, reject) {
		var ObjectsApi =new ForgeSDK.ObjectsApi () ;
		ObjectsApi.uploadChunk (config.bucket, fnname, buffer.length, contentRange, sessionId, buffer, {}, forgeToken.RW, forgeToken.RW.getCredentials ())
			.then (function (response) {
				fulfill (response) ;
			})
			.catch (function (error) {
				reject (error) ;
			}) ;
	})) ;
} ;

function postClosing (identifier, data, writer) {
	if ( data.size !== -1 )
		data.bytesRead =data.size ;
	else
		data.size =data.bytesRead ;

	if ( utils.isCompressed (data.name) ) {
	 	data.entries =[] ;
	 	var zip =new AdmZip (writer.toBuffer ()) ;
	 	zip.getEntries ().forEach (function (zipEntry) {
	 		//console.log (zipEntry.toString ()) ;
	 		if ( zipEntry.isDirectory === false )
	 			data.entries.push (zipEntry.entryName) ;
	 	}) ;
	}

	utils.writeFile (utils.data (identifier), data) ;

	function waitForAllChunkUpload () {
		if ( !chunkJobs.done (identifier) )
			return (setTimeout (waitForAllChunkUpload, 500)) ;
		saveChunk (identifier, data, writer) ; // Save the last chunk
	}

	if ( data.bytesPosted > 0 ) {
		waitForAllChunkUpload () ;
	} else if ( data.size > config.chunkSizeLimit ) {
		var numberOfChunks =Math.max (Math.ceil (data.size / (config.chunkSizeLimit * 1.0)), 1) ;
		for ( var i =0 ; i < numberOfChunks - 1 ; i ++ )
			saveChunk (identifier, data, writer) ;
		waitForAllChunkUpload () ;
	} else { // Small enough to upload in 1 piece
		data.bytesPosted =data.bytesRead ;
		objectToOSS (identifier, data.name, writer.toBuffer ())
			.then (function (response) {
				return (saveManifestAndProgress (response, data)) ;
			})
			.catch (function (error) {
				console.error (error) ;
			}) ;
	}


	// if ( data.bytesPosted > 0 ) {
	// 	var start =data.bytesPosted ;
	// 	var end =data.bytesRead - 1 ;
	// 	var contentRange ='bytes ' + start + '-' + end + '/' + data.size ;
	// 	data.bytesPosted =data.bytesRead ;
	// 	resumableToOSS (identifier, data.name, writer.toBuffer ().slice (start, end + 1), contentRange, data.sessionId)
	// 		.then (function (response) {
	// 			return (saveManifestAndProgress (response, data)) ;
	// 		})
	// 		.catch (function (error) {
	// 			console.error (error) ;
	// 		}) ;
	// } else {
	// 	data.bytesPosted =data.bytesRead ;
	// 	objectToOSS (identifier, data.name, writer.toBuffer ())
	// 		.then (function (response) {
	// 			return (saveManifestAndProgress (response, data)) ;
	// 		})
	// 		.catch (function (error) {
	// 			console.error (error) ;
	// 		}) ;
	// }
}

router.options ('/uri', bodyParser.json (), function (req, res) {
	var identifier =req.body.identifier ;
	fs.readFile (utils.data (identifier), function (err, data) {
		if ( err )
			return (res.status (500).end ()) ;
		try {
			data =JSON.parse (data) ;
			if ( data.size == -1 )
				throw 'error' ;
		} catch ( e ) {
			return (res.json ({ uniqueIdentifier: identifier, progress: -1 })) ;
		}
		res.json ({ uniqueIdentifier: identifier, progress: Math.floor (100 * data.bytesRead / data.size), entries: data.entries }) ;
	}) ;
}) ;

module.exports =router ;
