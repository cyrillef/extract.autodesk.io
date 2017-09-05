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
var bodyParser =require ('body-parser') ;
var fs =require ('fs') ;
var path =require ('path') ;
var ejs =require ('ejs') ;
//var AdmZip =require ('adm-zip') ;
var archiver =require ('archiver') ;
var ForgeSDK =require ('forge-apis') ;
var config =require ('./config') ;
var utils =require ('./utils') ;
var bubble =require ('./bubble') ;
var forgeToken =require ('./forge-token') ;
var viewerFileList =require ('./viewer') ;
var sendMail =require ('./sendMail') ;

var router =express.Router () ;
router.use (bodyParser.json ()) ;

// Download viewable data as a zip file containing all resources
var _locks ={} ;
var _progress ={} ;

// Get viewable data extraction progress
router.get ('/externals/:urn/progress', function (req, res) {
	var urn =req.params.urn ;
	res.json (_progress [urn] || { _progress: 100, msg: 'Completed' }) ;
}) ;

// Get viewable data extraction progress
router.get ('/externals/:urn/extract/:token', function (req, res) {
	var urn =req.params.urn ;
	var identifier =req.params.urn ;
	var token =req.params.token ;

	var manifest ='' ;
	utils.fileexists (utils.extracted (identifier + '.zip'))
		.then (function (bExists) {
			if ( bExists )
				fs.unlink (utils.extracted (identifier + '.zip')) ;
			// Are we already extracting?
			var bExtractionRunning =_locks.hasOwnProperty (identifier) ;
			if ( !bExtractionRunning )
				_locks [identifier] =[] ;
			if ( bExtractionRunning )
				throw new Error ('Bubble already being extracted!') ;

			_progress [identifier] ={ _filesToFetch: 0, _estimatedSize: 0, _progress: 0, msg: 'Initializing' } ;
			//return ({ urn: urn }) ;

			var oAuth2TwoLegged =new ForgeSDK.AuthClientTwoLegged ('dfgdfg', 'dfgdfgdfg', [ 'data:read' ]) ;
			oAuth2TwoLegged.setCredentials ({
				'token_type': 'Bearer',
				'expires_in': 1799,
				'access_token': token
			}) ;
			var ModelDerivative =new ForgeSDK.DerivativesApi () ;
			return (ModelDerivative.getManifest (urn, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials ())) ;
		})
		.then (function (json) {
			json =json.body ;
			if ( !json.hasOwnProperty ('urn') )
				throw new Error ('No URN') ;
			// Ok, we return a 200 HTTP code to the browser and we continue the extraction
			res.end () ;
			for ( var i =0 ; i < json.derivatives.length ; i++ ) {
				if ( json.derivatives [i].outputType === 'svf' ) {
					manifest =json.derivatives [i] ;
					break ;
				}
			}
			urn =urn || json.urn ;
			return (utils.rimraf (utils.path ('data/' + identifier))) ; // Just to make sure
		})
		.then (function (pathname) {
			var b =new bubble (_progress [identifier]) ;
			return (b.downloadBubble (urn, pathname + '/', token)) ;
		})
		.then (function (bubble) {
			// Generate local html, and bat/sh files
			_progress [identifier].msg ='Generating local html, and bat/sh files' ;
			return (GenerateStartupFiles (bubble, identifier)) ;
		})
		.then (function (bubble) {
			// Get Viewer files and dependencies
			_progress [identifier].msg ='Downloading latest Forge Viewer version (core and dependencies)' ;
			return (AddViewerFiles (bubble, identifier)) ;
		})
		.then (function (bubble) {
			// Generate zip file
			_progress [identifier].msg ='Preparing ZIP file' ;
			var inDir =utils.path ('data/' + identifier + '/') ;
			var outZip =utils.extracted (identifier + '.zip') ;
			return (PackBubble (inDir, outZip)) ;
		})
		.then (function (outZipFilename) {
			_progress [identifier].msg ='Cleaning workspace and notifying listeners' ;
			NotifyPeopleOfSuccess (identifier, _locks [identifier])
				.then (function () {
					delete _locks [identifier] ;
					delete _progress [identifier] ;
				}) ;
			return (utils.rimraf (utils.path ('data/' + identifier))) ;
		})
		.catch (function (error) {
			if (_progress [identifier] !== undefined )
				_progress [identifier].msg =error.message ;
			if ( error.message == 'Bubble already extracted!' || error.message == 'Bubble already being extracted!' )
				return (res.status (200).end (error.message)) ;
			utils.rimraf (utils.path ('data/' + identifier)) ;
			NotifyPeopleOfFailure (identifier, _locks [identifier], error)
				.then (function () {
					delete _locks [identifier] ;
					delete _progress [identifier] ;
				}) ;
			return (res.status (500).end (error.message)) ;
		})
	;
}) ;

function GenerateStartupFiles (bubble, identifier) {
	return (new Promise (function (fulfill, reject) {
		fs.createReadStream (utils.path ('views/readme.txt'))
			.pipe (fs.createWriteStream (utils.path ('data/' + identifier + '/readme.txt'))) ;
		fs.createReadStream (utils.path ('views/bat.ejs'))
			.pipe (fs.createWriteStream (utils.path ('data/' + identifier + '/index.bat'))) ;
		var ws =fs.createWriteStream (utils.path ('data/' + identifier + '/index')) ;
		fs.createReadStream (utils.path ('views/bash.ejs'))
			.pipe (ws) ;
		ws.on ('finish', function () {
			if ( /^win/.test (process.platform) === false )
				fs.chmodSync (utils.path ('data/' + identifier + '/index'), 0777) ;
		}) ;
		utils.readFile (utils.path ('views/view.ejs'), 'utf-8')
			.then (function (st) {
				var data =ejs.render (st, { docs: bubble._viewables }) ;
				var fullnameHtml =utils.path ('data/' + identifier + '/index.html') ;
				return (utils.writeFile (fullnameHtml, data, 'utf-8')) ;
			})
			.then (function (st) {
				fulfill (bubble) ;
			})
			.catch (function (error) {
				reject (error) ;
			})
		;
	})) ;
}

function AddViewerFiles (bubble, identifier) {
	return (new Promise (function (fulfill, reject) {
		var urns =viewerFileList.map (function (item) {
			return (DownloadViewerItem ('/viewingservice/v1/viewers/' + item, bubble._outPath, item)) ;
		}) ;
		Promise.all (urns)
			.then (function (urns) {
				var bower =utils.path ('www/bower_components') ;
				var data =utils.path ('data/' + identifier) ;
				fs.createReadStream (bower + '/jquery/dist/jquery.min.js')
					.pipe (fs.createWriteStream (data + '/jquery.min.js')) ;
				fs.createReadStream (bower + '/jquery-ui/jquery-ui.min.js')
					.pipe (fs.createWriteStream (data + '/jquery-ui.min.js')) ;
				fulfill (bubble) ;
			})
			.catch (function (error) {
				console.error ('Something wrong happened during viewer files download') ;
				reject (error) ;
			})
		;
	})) ;
}

function DownloadViewerItem  (uri, outPath, item) {
	uri +='?v=v2.15' ; // Temporary fix for viewer versioning issue on developer.api.autodesk.com
	return (new Promise (function (fulfill, reject) {
		var ModelDerivative =new ForgeSDK.DerivativesApi () ;
		ModelDerivative.apiClient.callApi (
			uri, 'GET',
			{}, {}, {},
			{}, null,
			[], [ 'application/octet-stream', 'image/png', 'text/html', 'text/css', 'text/javascript', 'application/json' ], null,
			forgeToken.RW, forgeToken.RW.getCredentials ()
		)
			.then (function (response) {
				//console.log (response.headers ['content-type'], item) ;
				var body =response.body ;
				if (   response.headers ['content-type'] == 'text/javascript'
					|| response.headers ['content-type'] == 'text/css'
				)
					body =response.body.toString ('utf8') ;
				if (   response.headers ['content-type'] == 'application/json'
					|| response.headers ['content-type'] == 'application/json; charset=utf-8'
				)
					body =JSON.stringify (response.body) ;
				console.log ('Downloaded:', outPath + item) ;
				return (utils.writeFile (outPath + item, body, null, true)) ;
			})
			.then (function (response) {
				fulfill (item) ;
			})
			.catch (function (error) {
				console.error (error) ;
				reject (error) ;
			})
		;
	})) ;
}

function PackBubble (inDir, outZip) {
	return (new Promise (function (fulfill, reject) {
		try {
			//var zip =new AdmZip () ;
			//zip.addLocalFolder (inDir) ;
			//zip.writeZip (outZip, function (error, result) {
			//	if ( error )
			//		reject (error) ;
			//	else
			//		fulfill (outZip) ;
			//}) ;

			var archive =archiver ('zip') ;
			archive.on ('error', function (err) {
				console.error ('PackBubble: ' + err) ;
				//reject (err) ;
			}) ;
			archive.on ('finish', function (err) {
				if ( err ) {
					console.error ('PackBubble: ' + err) ;
					reject (err) ;
				} else {
					console.log ('PackBubble ended successfully.') ;
					fulfill (outZip) ;
				}
			}) ;

			var output =fs.createWriteStream (outZip) ;
			archive.pipe (output) ;
			archive.directory (inDir, '') ;
			archive.finalize () ;
		} catch ( ex ) {
			reject (ex) ;
		}
	})) ;
}

function NotifyPeopleOfSuccess (identifier, locks) {
	return (NotifyPeople (identifier, locks, utils.path ('views/email-extract-succeeded.ejs'), 'Autodesk Forge Viewer Extractor notification')) ;
}

function NotifyPeopleOfFailure (identifier, locks, error) {
	return (NotifyPeople (identifier, locks, utils.path ('views/email-extract-failed.ejs'), 'Autodesk Forge Viewer Extractor failure')) ;
}

function NotifyPeople (identifier, locks, template, subject) {
	return (new Promise (function (fulfill, reject) {
		utils.readFile (template, 'utf-8')
			.then (function (st) {
				var data =ejs.render (st, { ID: identifier }) ;
				sendMail ({
					'from': 'ADN Sparks <adn.sparks@autodesk.com>',
					'replyTo': 'adn.sparks@autodesk.com',
					'to': locks,
					'subject': subject,
					'html': data,
					'forceEmbeddedImages': true
				}) ;
				fulfill () ;
			})
			.catch (function (error) {
				console.error (error) ;
				reject (error) ;
			})
		;
	})) ;
}

module.exports =router ;