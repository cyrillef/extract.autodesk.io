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
		$('#fileUploadArea').removeClass ('noshow') ;
		var elt =$("#fileupload-sample")
			.clone ()
			.prop ('id', 'flow-file-' + file.uniqueIdentifier)
			.removeClass ('noshow')
			.appendTo ($('#fileUploadArea div.list-group')) ;
		elt.children ('div.flow-file-name')
			.text (file.name) ;
	}) ;
	r.on ('uploadStart', function () {}) ;
	r.on ('fileProgress', function (file) {
		//console.log ('fileProgress') ;
		$('#flow-file-' + file.uniqueIdentifier + ' div.flow-file-progress progress')
			.prop ('value', Math.floor (r.progress () * 100)) ;
	}) ;
	r.on ('complete', function () {}) ;
	r.on ('fileSuccess', function (file, message) {
		$('#flow-file-' + file.uniqueIdentifier)
			.removeClass ('alert-info')
			.addClass ('alert-success')
			.prop ('title', message) ;
		$('#flow-file-' + file.uniqueIdentifier + ' div.flow-file-progress progress')
			.prop ('value', 100) ;
	}) ;
	r.on ('fileError', function (file, message) {
		// Reflect that the file upload has resulted in error
		$('#flow-file-' + file.uniqueIdentifier)
			.removeClass ('alert-info')
			.addClass ('alert-danger')
			.prop ('title', message) ;
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
