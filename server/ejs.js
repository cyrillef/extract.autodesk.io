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
var express =require ('express') ;
var request =require ('request') ;
var fs =require ('fs') ;
var ejs =require ('ejs') ;
var lmv =require ('./lmv') ;

var router =express.Router () ;

router.get ('/:identifier', function (req, res) {
	var bucket =lmv.Lmv.getDefaultBucket () ;
	var identifier =req.params.identifier ;

	var zipExist =false ;
	try {
		fs.lstatSync ('www/extracted/' + identifier + '.zip') ;
		zipExist =true ;
	} catch ( err ) {
	}

	try {
		var data =fs.readFileSync ('data/' + identifier + '.resultdb.json') ;
		data =JSON.parse (data) ;
		var obj ={
			urn: data.urn,
			'bucket': bucket,
			root: identifier,
			accessToken: lmv.Lmv.getToken (),
			extracted: zipExist.toString ()
		} ;
		res.render ('explore', obj) ;
	} catch ( err ) {
		res.status (404).end () ;
	}
}) ;

module.exports =router ;