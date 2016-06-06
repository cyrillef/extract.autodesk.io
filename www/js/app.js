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

	$('#new-project').click (function (evt) {
		evt.stopPropagation () ;
		location.reload () ;
	}) ;

	$('#create-project').click (function (evt) {
		evt.stopPropagation () ;
		var elts =$('div.alert-info[id^=flow-file-]') ;
		if ( elts.length != 0 )
			return (alert ('You need to wait for the upload to complete!')) ;
		elts =$('div.alert-success[id^=flow-file-]') ;
		if ( elts.length == 0 )
			return (alert ('There is no file loaded successfully!')) ;
		if ( elts.length > 1 ) { // Show the dependency editor
			window.jsp.reset () ;
			window.jsp.bind ('click', function (c) { window.jsp.detach (c) ; }) ;
			$('#dependencyEditorCanvas')
				.children ('.jtk-surface-canvas')
				.empty () ;
			var node0 =undefined ;
			$.each (elts, function (index, elt) {
				var node =addJsPlumbNode ({
					name: $(elt).children ('.flow-file-name').text (),
					uniqueIdentifier: $(elt).prop ('id').replace (/^flow-file-/, '')
				}) ;
				node0 =node0 || node ;
				if ( node0 !== node )
					connectJsPlumbNodes (node0, node) ;
			}) ;
			$('#dependencyEditorDialog').modal () ;
			// See to continue - $("#dependencyEditorDialog .btn").on ('click'
		} else { // No need for dependency editor
			var data ={
				name: $(elts [0]).children ('.flow-file-name').text (),
				uniqueIdentifier: $(elts [0]).prop ('id').replace (/^flow-file-/, ''),
				children: []
			} ;
			//$('#dependencyEditorDialog').modal () ; // No need
			submitProject (data) ;
		}
	}) ;

	$('#dependencyEditorDialog').on ('shown.bs.modal', function() {
		autoArrangeJsPlumb () ;
	})

	$("#dependencyEditorDialog .btn").on ('click', function (evt) {
		//evt.stopPropagation () ;
		//var nodes =$('.statemachine .w') ;
		var edges =window.jsp.getAllConnections () ;
		var data =buildDependencyTree (edges) ;
		submitProject (data) ;
		//$('#dependencyEditorDialog').modal ('hide') ;
	});

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
			createProjectVignette (results [i].name, results [i]) ;
	}) ;
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
		//-   2. set the dependencies between files
		//-   3. register files to the translation service
		//- We can now wait for the service to complete translation

		var root =data.uniqueIdentifier ;
		createProjectVignette (root, { 'progress': 'requested', 'success': '0%', 'hasThumbnail': 'true' }) ;
		$('#tabs #view-project-tab a').tab ('show') ;
		//$('#projectProgressDialog').modal () ;

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
				$(name + ' div p').text ('success (' + response.success + ')') ;
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
				$(name + ' progress').val (parseInt (response.success) || 0) ;
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

function createProjectVignette (identifier, data) {
	data.hasThumbnail =data.hasThumbnail || 'false' ;
	data.progress =data.progress || 'complete' ;
	if ( data.hasThumbnail == 'false' )
		data.progress ='project' ;
	data.success =data.success || '100%' ;
	var name =identifier ;
	var progressui =(data.progress != 'complete' && data.progress != 'failed' ? '<progress class="project-progress-bar" value="' + parseInt (data.success) + '" max="100"></progress>' : '') ;
	var imageui =(data.progress == 'complete' ?
		  '/extracted/' + name + '.png'
		: (data.progress == 'failed' ? '/images/failed.png' : '/images/processing.png')) ;
	var url =(data.progress != 'failed' ? '/explore/' + identifier : '#') ;
	$('#vignette-' + name).remove () ;
	$('#project-results').append (
			'<div class="view view-first flex-item" id="vignette-' + name + '">'
				//+	'<a href="#' + name + '" />'
			+	'<img src="' + imageui + '" />'
			+ 	'<div class="mask">'
			+		'<h2>' + identifier + '</h2>'
			+		'<p>' + data.progress + ' (' + data.success + ')</p>'
			+		'<a href="' + url + '" class="info" target="' + name + '">Explore</a>'
			+	'</div>'
			+	progressui
			+ '</div>'
	) ;
	if ( data.progress != 'complete' && data.progress != 'failed' ) {
		console.log ('progress state = ' + data.progress) ;
		setTimeout (function () { projectProgress (identifier) ; }, 5000) ;
	}
}

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