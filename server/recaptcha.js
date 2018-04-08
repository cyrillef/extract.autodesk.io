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
var config =require ('./config') ;
var unirest =require ('unirest') ;
// var express =require ('express') ;
// var bodyParser =require ('body-parser') ;
//
// var router =express.Router () ;
// router.use (bodyParser.json ()) ;

var reCAPTCHA =function (response, cb) {
	//return (cb (true)) ;
	unirest.post ('https://www.google.com/recaptcha/api/siteverify')
		.header ('Accept', 'application/json')
		.send ({
			'secret': config.RECAPTCHA_SECRET,
			'response': response
			// remoteip
		})
		.end (function (res) { // res.body.success == true
			cb (res.body.success)
		}) ;
} ;

module.exports =reCAPTCHA ;