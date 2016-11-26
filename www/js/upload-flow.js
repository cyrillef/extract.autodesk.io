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
$(document).ready (function () {
	var r =new Flow ({
		target: '/api/file',
		chunkSize: 1024 * 1024,
		/*forceChunkSize: true,*/
		testChunks: false
	}) ;
	// Flow.js isn't supported, fall back on a different method
	if ( !r.support ) {
		$('.flow-error').show () ;
		return ;
	}

	// Handle file add event
	r.on ('filesSubmitted', function (file) {
		console.log ('filesSubmitted') ;
		r.upload () ;
	}) ;
	r.on ('fileAdded', function (file) {
		fileUploadItem.createElt (file.uniqueIdentifier, file.name) ;
	}) ;
	r.on ('uploadStart', function () {}) ;
	r.on ('fileProgress', function (file) {
		fileUploadItem.progress (file.uniqueIdentifier, Math.floor (r.progress () * 100)) ;
	}) ;
	r.on ('complete', function () {}) ;
	r.on ('fileSuccess', function (file, message) {
		fileUploadItem.success (file.uniqueIdentifier, message) ;
	}) ;
	r.on ('fileError', function (file, message) {
		fileUploadItem.error (file.uniqueIdentifier, message) ;
	}) ;
	r.on ('catchAll', function () {
		console.log.apply (console, arguments) ;
	}) ;

	window.r ={
		pause: function () {
			r.pause () ;
		},
		cancel: function () {
			r.cancel () ;
		},
		upload: function () {
			r.resume () ;
		},
		flow: r
	} ;

}) ;
