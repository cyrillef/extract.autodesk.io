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
// http://blog.niftysnippets.org/2008/03/mythical-methods.html
//
var express =require ('express') ;
var fs =require ('fs') ;
var ejs =require ('ejs') ;
var config =require ('./config') ;
var utils =require ('./utils') ;
var forgeToken =require ('./forge-token') ;

var router =express.Router () ;

router.get ('/:identifier', function (req, res) {
	var bucket =config.bucket ;
	var identifier =req.params.identifier ;

	var zipExist =false ;
	utils.fileexists (utils.extracted (identifier + '.zip'))
		.then (function (bExists) {
			zipExist =bExists ;
			return (utils.json (identifier + '.resultdb')) ;
		})
		.then (function (data) {
			var obj ={
				version: config.viewerVersion,
				urn: data.urn,
				bucket: bucket,
				root: identifier,
				accessToken: forgeToken.RO.getCredentials ().access_token,
				extracted: zipExist.toString ()
			} ;
			res.render ('explore', obj) ;
		})
		.catch (function (error) {
			res.status (404).end () ;
		})
	;
}) ;

module.exports =router ;