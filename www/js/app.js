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
var inMaintenance =false ;

$(document).ready (function () {
	if ( inMaintenance )
		$('#MaintenanceMsg').modal () ;

	$('#tabs').tab () ;
	listProjects () ;

	$('#help-information').click (function (evt) {
		evt.stopPropagation () ;
		$('#HelpMsg').modal () ;
	}) ;

	$('#clear-workspace').click (function (evt) {
		evt.stopPropagation () ;
		location.reload () ;
	}) ;

	$('#submit-project').attr ('disabled', 'disabled') ;
	$('#submit-project').click (function (evt) {
		if ( inMaintenance ) {
			$('#MaintenanceMsg').modal () ;
			return ;
		}
		var recaptcha =grecaptcha.getResponse () ;
		if ( recaptcha == '' )
			return ;

		evt.stopPropagation () ;
		var elts =$('div.alert-info[id^=flow-file-]') ;
		if ( elts.length !== 0 )
			return (alert ('You need to wait for the upload to complete!')) ;
		elts =$('div.alert-success[id^=flow-file-]') ;
		if ( elts.length === 0 )
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
		submitProject (data, recaptcha) ;
	}) ;

	$('#projectProgressDialog').on ('shown.bs.modal', function () {
		$("#projectProgressDialog").draggable ({ handle: ".modal-header" }) ;
	}) ;

	$('#searchText').on ('keyup', function (evt) {
		searchProject (evt) ;
	}) ;
	$('#searchText').on ('search', function (evt) {
		searchProject (evt) ;
	}) ;
}) ;

function searchProject (evt) {
	evt.stopPropagation () ;
	if ( evt.target.value == '' ) {
		$('div[id^=vignette-]').show () ;
		return ;
	}
	var ll =$('div[id*=' + evt.target.value + ' i].view') ;
	$('div[id^=vignette-]').hide () ;
	if ( ll.length > 0 )
		ll.show () ;
}

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

// htmlentities
var htmlentities =function (st) {
	var result =st.replace (/[\u00A0-\u9999<>\&]/gim, function (i) {
		return ('&#' + i.charCodeAt (0) + ';') ;
	}) ;
	return (result) ;
} ;

function createProjectVignette (identifier, data) {
	if ( identifier === undefined )
		return ;
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
		'<div class="view view-first flex-item" id="vignette-' + identifier + '" title="' + htmlentities (decodeURIComponent (data.name)) + '">'
			//+	'<a href="#' + identifier + '" />'
		+	'<img src="' + imageui + '" class="thumbnail" />'
		+ 	'<div class="mask">'
		+		'<h2>' + htmlentities (decodeURIComponent (data.name)) + '</h2>'
		+		'<p>' + data.progress + ' (' + data.success + ')</p>'
		//+		'<a href="' + url + '" class="info" target="' + identifier + '">Explore</a>'
		+		'<a href="javascript:void(0)" data="' + url + '" class="info" target="' + identifier + '">Please Wait</a>'
		+ '<a href="javascript:void(0)" onclick="deleteProject (\'' + identifier + '\')"><img src="/images/delete.24x24.png" class="deleteButton" title="Delete project"/></a>'
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

function deleteProject (identifier) {
	if ( confirm ('Are you sure you want to delete that project?') ) {
		$.ajax ({
			url: '/api/results/' + identifier,
			type: 'delete',
			complete: null
		}).done (function (results) {
			$('#vignette-' + identifier).remove () ;
		}).fail (function (error) {
			alert ('Failed to delete the project') ;
			console.error (error) ;
		}) ;
	}
}

function submitProject (data, recaptcha) {
	if ( inMaintenance ) {
		$('#MaintenanceMsg').modal () ;
		return ;
	}
	if ( recaptcha === undefined || recaptcha == '' )
		return ;
	data.recaptcha =recaptcha ;
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
	if ( inMaintenance )
		return ;

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
}

function scrollTo (identifier) {
	var name ='#vignette-' + identifier ;
	// Calculate destination place
	if ( $(name).length === 0 )
		return ;
	var dest =$(name).offset ().top ;
	if ( $(name).offset ().top > $(document).height () - $(window).height () )
		dest =$(document).height () - $(window).height () ;
	// Go to destination
	$('html, body').animate ({ scrollTop: dest }, 1000, 'swing') ;
}

// File Upload
var fileUploadItem ={

	/*static */createElt: function (identifier, filename) {
		$('#fileUploadArea').removeClass ('noshow') ;
		var elt =$("#fileupload-sample")
			.clone ()
			.prop ('id', 'flow-file-' + identifier)
			.removeClass ('noshow')
			.appendTo ($('#fileUploadArea div.list-group')) ;
		elt.children ('div.flow-file-name')
			.text (filename) ;
	},

	/*static*/progress: function (identifier, progress) {
		$('#flow-file-' + identifier + ' div.flow-file-progress progress')
			.prop ('value', progress) ;
	},

	/*static*/success: function (identifier, message) {
		$('#flow-file-' + identifier)
			.removeClass ('alert-info')
			.addClass ('alert-success')
			.prop ('title', message) ;
		$('#flow-file-' + identifier + ' div.flow-file-progress progress')
			.prop ('value', 100) ;
		var test =$('#fileUploadArea div.glyphicon-home') ;
		var glyph =test === undefined || test.length === 0 ? 'glyphicon-home' : 'glyphicon-ok' ;
		$('#flow-file-' + identifier + ' .glyphicon')
			.removeClass ('glyphicon-cloud-upload')
			.addClass (glyph)
			.click (fileUploadItem.selectAsHome) ;

		if ( typeof message === 'string' ) {
			try {
				message =JSON.parse (message) ;
			} catch ( e ) {
				message ={} ;
			}
		}
		if ( message.entries !== undefined && message.entries.length > 0 ) {
			$('#flow-file-' + identifier + ' .glyphicon')
				.removeClass (glyph)
				.addClass ('glyphicon-ok')
				.unbind ('click') ;
			for ( var i =0 ; i < message.entries.length ; i++ ) {
				var entry =message.entries [i] ;
				var elt =$("#fileupload-sample-sub")
					.clone ()
					.prop ('id', 'flow-file-' + identifier + '-' + entry)
					.removeClass ('noshow')
					.removeClass ('alert-info')
					.addClass ('alert-success')
					.appendTo ($('#fileUploadArea div.list-group')) ;
				elt.children ('div.flow-file-name')
					.text (entry) ;
				elt.children ('div.glyphicon')
					.removeClass ('glyphicon-cloud-upload')
					.addClass (glyph)
					.click (fileUploadItem.selectAsHome) ;
				glyph ='glyphicon-ok' ;
			}
		}
	},

	/*static */selectAsHome: function (evt) {
		evt.stopPropagation () ;
		$('#fileUploadArea div.list-group')
			.find ('div.glyphicon-home')
			.removeClass ('glyphicon-home')
			.addClass ('glyphicon-ok') ;
		$(evt.target)
			.removeClass ('glyphicon-ok')
			.addClass ('glyphicon-home') ;
	},

	/*static*/error: function (identifier, message) {
		$('#flow-file-' + identifier)
			.removeClass ('alert-info')
			.addClass ('alert-danger')
			.prop ('title', message) ;
		$('#flow-file-' + identifier + ' .glyphicon')
			.removeClass ('glyphicon-cloud-upload')
			.addClass ('glyphicon-remove') ;
	}

} ;

// reCAPTCHA
function imNotARobot (val) {
	if ( val !== undefined && val !== null && val !== '' )
		$('#submit-project').attr ('disabled', null) ;
}

function imARobot () {
	$('#submit-project').attr ('disabled', 'disabled') ;
}
