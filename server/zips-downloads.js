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
var JSZip =require ('jszip') ;
var utils =require ('./utils') ;
var config =require ('./config') ;

var router =express.Router () ;
router.use (bodyParser.json ()) ;

// Get zip
router.get ('/:identifier', function (req, res) {
	var identifier =req.params.identifier ;
	var sqllite =req.query.db ;
	var viewer_files =req.query.viewer ;
	var zip_filename =identifier + '.zip' ;
	var zip_sqllite =identifier + '-db.zip' ;
	var zip_viewer ='viewer-' + config.viewerVersion + '.zip' ;

	var zip =new JSZip () ;
	utils.readFile (utils.path ('/www/extracted/' + zip_filename))
		.then (function (data) {
			return (zip.loadAsync (data)) ;
		})
		.then (function (content) {
			// if ( sqllite === 'true' )
			// 	return (zip.file (utils.path ('/www/extracted/' + zip_sqllite)).async ('string')) ;
			// else
			// 	return (content) ;
			if ( sqllite !== 'true' )
				return (content) ;
			return (
				utils.readFile (utils.path ('/www/extracted/' + zip_sqllite))
					.then (function (data) {
						return (zip.loadAsync (data)) ;
					})
			) ;
		})
		.then (function (content) {
			if ( viewer_files !== 'true' )
				return (content) ;
			return (
				utils.readFile (utils.path ('/www/extracted/' + zip_viewer))
					.then (function (data) {
						return (zip.loadAsync (data)) ;
					})
			) ;
		})
		.then (function (content) {
			return (zip.generateAsync ({ type: 'nodebuffer' })) ;
		})
		.then (function (content) {
			res.set ('Content-Type', 'application/zip') ;
			res.set ('Content-Disposition', 'attachment; filename=' + zip_filename) ;
			res.set ('Content-Length', content.length) ;
			res.end (content, 'binary') ;
		})
		.catch (function (err) {
			res.status (404).end () ;
		}) ;

	// var fn =utils.path ('/www/extracted/' + zip_filename) ;
	// utils.readFile (fn, 'binary')
	// 	.then (function (data) {
	// 		res.set ('Content-Type', 'application/zip') ;
	// 		res.set ('Content-Disposition', 'attachment; filename=' + zip_filename) ;
	// 		res.set ('Content-Length', data.length) ;
	// 		res.end (data, 'binary') ;
	// 	})
	// 	.catch (function (err) {
	// 		res.status (404).end () ;
	// 	}) ;
}) ;

module.exports =router ;