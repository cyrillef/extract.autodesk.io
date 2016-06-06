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
var favicon =require ('serve-favicon') ;
var lmvToken =require ('./lmv-token') ;
var lmvProjects =require ('./lmv-projects') ;
var lmvResults =require ('./lmv-results') ;
var lmvFile =require ('./file') ;
var ejs =require ('./ejs') ;

// http://garann.github.io/template-chooser/
var app =express () ;
//app.use (bodyParser.urlencoded ({ extended: true })) ; // Support encoded bodies
app.use (bodyParser.json ()) ;
app.use (express.static (__dirname + '/../www')) ;
app.use (favicon (__dirname + '/../www/favicon.ico')) ;
app.set ('view engine', 'ejs') ;
app.use ('/explore', ejs) ;
app.use ('/api', lmvToken) ;
app.use ('/api', lmvProjects) ;
app.use ('/api', lmvResults) ;
app.use ('/api', lmvFile) ;

app.set ('port', process.env.PORT || 80) ;

module.exports =app ;