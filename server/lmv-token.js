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
var lmv =require ('./lmv') ;

function initializeApp () {
	var seconds =1000 ; // Service returns 1799 seconds bearer token
	setInterval (lmv.Lmv.refreshToken, seconds * 1000) ;
	lmv.Lmv.refreshToken () ;
}
initializeApp () ;

var router =express.Router () ;
router.get ('/token', function (req, res) {
	res.setHeader ('Content-Type', 'text/plain') ;
	res.send (lmv.Lmv.getToken ()) ;
}) ;

router.post ('/setup', bodyParser.urlencoded ({ extended: false }), function (req, res) {
	var key =req.body.key.trim () ;
	var  secret =req.body.secret.trim () ;
	var data =fs.readFile ('server/credentials_.js', 'utf-8', function (err, data) {
		if ( err ) {
			res.status (500).end ('No file named server/credentials_.js!') ;
			return ;
		}

		data =data.toString ('utf8') ;
		data =data.replace ('<replace with your consumer key>', key) ;
		data =data.replace ('<replace with your consumer secret>', secret) ;

		fs.writeFile ('server/credentials.js', data, function (err) {
			if ( err ) {
				res.status (500).end ('Cannot save server/credentials.js file!') ;
				return ;
			}
			lmv.Lmv.refreshToken () ; // Get a token now
			res.writeHead (301, { Location: '/' }) ;
			res.end () ;
		}) ;
	}) ;
}) ;

module.exports =router ;
