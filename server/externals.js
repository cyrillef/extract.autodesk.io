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

var ForgeSDK =require ('forge-apis') ;
var config =require ('./config') ;
var utils =require ('./utils') ;
var Bubble =require ('./bubble') ;
var forgeToken =require ('./forge-token') ;

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
			var b =new Bubble.bubble (_progress [identifier]) ;
			return (b.downloadBubble (urn, pathname + '/', token)) ;
		})
		.then (function (bubble) {
			// Generate local html, and bat/sh files
			_progress [identifier].msg ='Generating local html, and bat/sh files' ;
			return (Bubble.utils.GenerateStartupFiles (bubble, identifier)) ;
		})
		.then (function (bubble) {
			// Get Viewer files and dependencies
			_progress [identifier].msg ='Downloading latest Forge Viewer version (core and dependencies)' ;
			return (Bubble.utils.AddViewerFiles (bubble, identifier)) ;
		})
		.then (function (bubble) {
			// Generate zip file
			_progress [identifier].msg ='Preparing ZIP file' ;
			var inDir =utils.path ('data/' + identifier + '/') ;
			var outZip =utils.extracted (identifier + '.zip') ;
			return (Bubble.utils.PackBubble (inDir, outZip)) ;
		})
		.then (function (outZipFilename) {
			_progress [identifier].msg ='Cleaning workspace and notifying listeners' ;
			Bubble.utils.NotifyPeopleOfSuccess (identifier, _locks [identifier])
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
			Bubble.utils.NotifyPeopleOfFailure (identifier, _locks [identifier], error)
				.then (function () {
					delete _locks [identifier] ;
					delete _progress [identifier] ;
				}) ;
			return (res.status (500).end (error.message)) ;
		})
	;
}) ;

module.exports =router ;