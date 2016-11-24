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

	$('#tabs').tab () ;
	listProjects () ;

	$('#usage-control').click (function (evt) {
		evt.stopPropagation () ;
		var hidden =!($('#usage').hasClass ('noshow')) ;
		$('#usage').toggleClass ('noshow') ;
		$('#usage-control').text ((hidden ? 'Show' : 'Hide') + ' Description & Information') ;
		$.cookie ('usage', hidden ? 'hidden' : 'visible', { expires: 365 }) ;
	}) ;
	var hidden =$.cookie ("usage") ;
	if ( hidden ) {
		$('#usage').addClass ('noshow') ;
		$('#usage-control').text ('Show Description & Information') ;
	}

	$('#clear-workspace').click (function (evt) {
		evt.stopPropagation () ;
		location.reload () ;
	}) ;

	$('#submit-project').click (function (evt) {
		evt.stopPropagation () ;
		var elts =$('div.alert-info[id^=flow-file-]') ;
		if ( elts.length != 0 )
			return (alert ('You need to wait for the upload to complete!')) ;
		elts =$('div.alert-success[id^=flow-file-]') ;
		if ( elts.length == 0 )
			return (alert ('No files were uploaded successfully!')) ;

		var main =$('#fileUploadArea div.list-group')
			.find ('div.glyphicon-home')
			.parent () ;
		var name =$(main).children ('.flow-file-name').text () ;
		var regexpr =new RegExp ('-' + name + '$') ;
		var identifier =$(main).prop ('id').replace (/^flow-file-/, '').replace (regexpr, '') ;
		var data ={
			main: name,
			name: $('#flow-file-' + identifier).children ('.flow-file-name').text (),
			uniqueIdentifier: identifier,
			children: []
		} ;
		for ( var i =0 ; i < elts.length ; i++ ) {
			var elt =$(elts [i]) ;
			name =elt.children ('.flow-file-name').text () ;
			regexpr =new RegExp ('-' + name + '$') ;
			name =elt.prop ('id').replace (/^flow-file-/, '').replace (regexpr, '') ;
			if ( $.inArray (name, data.children) == -1 )
				data.children.push (name) ;
		}
		//console.log (JSON.stringify (data)) ;
		submitProject (data) ;
	}) ;

	$('#projectProgressDialog').on ('shown.bs.modal', function () {
		$("#projectProgressDialog").draggable ({ handle: ".modal-header" }) ;
	}) ;

}) ;

// List existing project results
function listProjects () {
	$.ajax ({
		url: '/api/results',
		type: 'get',
		//data: null,
		contentType: 'application/json',
		complete: null
	}).done (function (results) {
		for ( var i =0 ; i < results.length ; i++ )
			createProjectVignette (results [i].key, results [i]) ;
	}) ;
}

function createProjectVignette (identifier, data) {
	data.hasThumbnail =data.hasThumbnail || 'false' ;
	data.progress =data.progress || 'complete' ;
	if ( data.hasThumbnail == 'false' )
		data.progress ='project' ;
	data.success =data.success || '100%' ;
	var progressui =(data.progress != 'complete' && data.progress != 'failed' ? '<progress class="project-progress-bar" value="' + parseInt (data.success) + '" max="100"></progress>' : '') ;
	var imageui =(data.progress == 'complete' ?
		  '/extracted/' + identifier + '.png'
		: (data.progress == 'failed' ? '/images/failed.png' : '/images/processing.png')) ;
	var url =(data.progress != 'failed' ? '/explore/' + identifier : '#') ;
	$('#vignette-' + identifier).remove () ;
	$('#project-results').append (
		'<div class="view view-first flex-item" id="vignette-' + identifier + '">'
			//+	'<a href="#' + identifier + '" />'
		+	'<img src="' + imageui + '" />'
		+ 	'<div class="mask">'
		+		'<h2>' + data.name + '</h2>'
		+		'<p>' + data.progress + ' (' + data.success + ')</p>'
		//+		'<a href="' + url + '" class="info" target="' + identifier + '">Explore</a>'
		+		'<a href="javascript:void(0)" data="' + url + '" class="info" target="' + identifier + '">Please Wait</a>'
		+	'</div>'
		+	progressui
		+ '</div>'
	) ;
	if ( data.progress != 'complete' && data.progress != 'failed' ) {
		console.log ('progress state = ' + data.progress) ;
		setTimeout (function () { projectProgress (identifier) ; }, 5000) ;
	}
	if ( data.progress == 'complete' )
		$('#vignette-' + identifier + ' div a.info').unbind ('click').text ('Explore').attr ('href', '/explore/' + identifier) ;
}

function submitProject (data) {
	$.ajax ({
		url: '/api/projects',
		type: 'post',
		data: JSON.stringify (data),
		contentType: 'application/json',
		complete: null
	}).done (function (response) {
		//- At this stage we asked the server to:
		//-   1. upload the files on the Autodesk server
		//-   2. post a svf translation job to the Model Derivative Service
		//- We can now wait for the service to complete translation

		var root =data.uniqueIdentifier ;
		createProjectVignette (root, { 'name': data.name, 'progress': 'requested', 'success': '0%', 'hasThumbnail': 'true' }) ;
		$('#tabs #view-project-tab a').tab ('show') ;

		setTimeout (function () { scrollTo (root) ; }, 100) ;
		setTimeout (function () { projectProgress (root) ; }, 5000) ;
	}).fail (function (xhr, ajaxOptions, thrownError) {
		alert ('Failed to create your project!') ;
	}) ;
}

function projectProgress (root, nb) {
	nb =nb || 0 ;
	$.ajax ({
		url: '/api/projects/' + root + '/progress',
		type: 'get',
		//data: JSON.stringify ({ 'bucket': bucket, 'root': root }),
		contentType: 'application/json',
		complete: null
	}).done (function (response) {
		var name ='#vignette-' + root ;
		//console.log (response) ;
		if ( response.progress == 'complete' ) {
			$(name + ' progress').remove () ;
			if ( response.status == 'success' ) {
				$(name + ' div p').text ('success (' + response.status + ')') ;
				$(name + ' div a.info').unbind ('click').text ('Explore').attr ('href', '/explore/' + root) ;

				if ( response.hasThumbnail == 'true' ) {
					$.ajax ({
						url: '/api/results/' + root + '/thumbnail',
						type: 'get',
						complete: null
					}).done (function (response) {
						$(name + ' img').attr ('src', '/extracted/' + root + '.png') ;
					}) ;
				} else {
					$(name + ' img').attr ('src', '/images/project.png') ;
				}
			} else {
				$(name + ' div p').text ('Failed!') ;
				$(name + ' img').attr ('src', '/images/failed.png') ;
			}
		} else {
			if ( response.progress === 'uploading to oss' )
				$(name + ' progress').val (parseInt (response.oss) || 0) ;
			else
				$(name + ' progress').val (parseInt (response.progress) || 0) ;
			$(name + ' div p').text (response.progress) ;
			setTimeout (function () { projectProgress (root) ; }, 1000) ;
		}
	}).fail (function (xhr, ajaxOptions, thrownError) {
		console.log ('Progress request failed!') ;
		if ( nb < 2 ) {
			setTimeout (function () { projectProgress (root, ++nb) ; }, 2500) ;
			return ;
		}
		var name ='#vignette-' + root ;
		$(name + ' progress').remove () ;
		$(name + ' div p').text ('Failed!') ;
		$(name + ' img').attr ('src', '/images/failed.png') ;
	}) ;
} ;

function scrollTo (identifier) {
	var name ='#vignette-' + identifier ;
	// Calculate destination place
	if ( $(name).length == 0 )
		return ;
	var dest =$(name).offset ().top ;
	if ( $(name).offset ().top > $(document).height () - $(window).height () )
		dest =$(document).height () - $(window).height () ;
	// Go to destination
	$('html, body').animate ({ scrollTop: dest }, 1000, 'swing') ;
}