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
		var test =$('#fileUploadArea div.glyphicon-home') ;
		var glyph =test == undefined || test.length == 0 ? 'glyphicon-home' : 'glyphicon-ok' ;
		$('#flow-file-' + file.uniqueIdentifier + ' .glyphicon')
			.removeClass ('glyphicon-cloud-upload')
			.addClass (glyph)
			.click (selectAsHome) ;

		try {
			message =JSON.parse (message) ;
		} catch ( e ) {
			message ={} ;
		}
		if ( message.entries != undefined && message.entries.length > 0 ) {
			$('#flow-file-' + file.uniqueIdentifier + ' .glyphicon')
				.removeClass (glyph)
				.addClass ('glyphicon-ok')
				.unbind ('click') ;
			for ( var i =0 ; i < message.entries.length ; i++ ) {
				var entry =message.entries [i] ;
				var elt =$("#fileupload-sample-sub")
					.clone ()
					.prop ('id', 'flow-file-' + file.uniqueIdentifier + '-' + entry)
					.removeClass ('noshow')
					.removeClass ('alert-info')
					.addClass ('alert-success')
					.appendTo ($('#fileUploadArea div.list-group')) ;
				elt.children ('div.flow-file-name')
					.text (entry) ;
				elt.children ('div.glyphicon')
					.removeClass ('glyphicon-cloud-upload')
					.addClass (glyph)
					.click (selectAsHome) ;
				glyph ='glyphicon-ok' ;
			}
		}
	}) ;
	r.on ('fileError', function (file, message) {
		// Reflect that the file upload has resulted in error
		$('#flow-file-' + file.uniqueIdentifier)
			.removeClass ('alert-info')
			.addClass ('alert-danger')
			.prop ('title', message) ;
		$('#flow-file-' + file.uniqueIdentifier + ' .glyphicon')
			.removeClass ('glyphicon-cloud-upload')
			.addClass ('glyphicon-remove') ;
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

function selectAsHome (evt) {
	evt.stopPropagation () ;
	$('#fileUploadArea div.list-group')
		.find ('div.glyphicon-home')
		.removeClass ('glyphicon-home')
		.addClass ('glyphicon-ok') ;
	$(evt.target)
		.removeClass ('glyphicon-ok')
		.addClass ('glyphicon-home') ;
}
