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
var favicon =require ('serve-favicon') ;
var ejs =require ('./ejs') ;
var forgeToken =require ('./forge-token') ; // Force loading
var fileUpload =require ('./upload-flow') ;
var projects =require ('./projects') ;
var results =require ('./results') ;
var zipsDownloads =require ('./zips-downloads') ;
//var resultsExternals =require ('./externals') ;
var forgeProxy =require ('./forge-proxy') ;

var app =express () ;
//app.use (bodyParser.urlencoded ({ extended: true })) ; // Support encoded bodies
app.use (bodyParser.json ()) ;
app.use (express.static (__dirname + '/../www')) ;
app.use (favicon (__dirname + '/../www/favicon.ico')) ;
app.set ('view engine', 'ejs') ;
app.use ('/explore', ejs) ;
app.use ('/api', fileUpload) ;
app.use ('/api', projects) ;
app.use ('/api', results) ;
app.use ('/extracted/zips', zipsDownloads) ;
//app.use ('/api', resultsExternals) ;
app.get ('/forge-proxy/*', forgeProxy.get) ;

app.set ('port', process.env.PORT || 80) ;

module.exports =app ;