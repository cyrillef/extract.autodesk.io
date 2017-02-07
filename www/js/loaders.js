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
    $('#upload-modal input[type=file]').change (function (evt) {
        evt.stopPropagation () ;
        //var files =$(evt.target).prop ("files") ;
        window.r.flow.addFiles (evt.target.files, evt) ;
        //window.r.upload () ;
    }) ;

    $('#upload-modal li#uri-input button').click (function (evt) {
        evt.stopPropagation () ;
        var elt =$('#upload-modal li#uri-input input[type=text]') ;
        var uri =elt.prop ('value') ;
        uploadFile (uri) ;
        elt.prop ('value', '') ;
    }) ;

	loadersInitialize ("#dropbox", "#box", "#gDrive") ;
}) ;

function uploadFile (uri, filename, size) {
	if ( uri === '' )
		return ;
	console.log ('uri: ' + uri) ;
	filename =filename || decodeURIComponent (uri).replace (/[\?#].*$/, "").replace (/.*\//, "") ;
	size =size || filename.hashCode () ;
	var uniqueIdentifier =size + '-' + filename.replace (/[^0-9a-zA-Z_-]/img, '') ;
	fileUploadItem.createElt (uniqueIdentifier, filename) ;
	$.ajax ({
		url: '/api/uri',
		type: 'post',
		data: JSON.stringify ({
			uri: uri,
			identifier: uniqueIdentifier,
			name: filename
		}),
		contentType: 'application/json',
		//dataType: 'json',
		//timeout: 0,
		complete: null
	}).done (function (response) {
		uploadFileProgress (uniqueIdentifier) ;
	}).fail (function (xhr, ajaxOptions, thrownError) {
		fileUploadItem.error (uniqueIdentifier, xhr.responseText || '') ;
	}) ;
}

function uploadFileProgress (uniqueIdentifier) {
	var uploadFileProgressInterval =setInterval (function () {
		$.ajax ({
			url: '/api/uri',
			type: 'options',
			data: JSON.stringify ({ identifier: uniqueIdentifier }),
			contentType: 'application/json',
			complete: null
		}).done (function (response) {
			if ( response.progress === -1 ) {
				// Do nothing!
			} else if ( response.progress === 100 ) {
				clearInterval (uploadFileProgressInterval) ;
				fileUploadItem.success (uniqueIdentifier, response) ;
			} else {
				fileUploadItem.progress (uniqueIdentifier, response.progress) ;
			}
		}).fail (function (xhr, ajaxOptions, thrownError) {
			clearInterval (uploadFileProgressInterval) ;
			fileUploadItem.error (uniqueIdentifier, xhr.responseText || '') ;
		}) ;
	}, 2000) ;
}

var keys = {
    //dropboxApiKey: "z6n42hqk7j6teb2",
    dropboxApiKey: 'pdnli15y8271xkf',
    boxApiKey: '"rtrdly7yhy1jn5ogcx7zlb8ek83nom2s',
    //gapiClientId: '481463395991-i8beh0c0g3ei8bbptmos1b129s4h3fas.apps.googleusercontent.com',
    //gapiKey: 'AIzaSyAPaP6WXSx_pjT-sQF3HyNcNZiPZAxumWs',
    gapiClientId: '861963580135-s5bhrka091n1un4letqfrafg3abn41t1.apps.googleusercontent.com',
    gapiKey: 'AIzaSyAsdhYT8LmF3YMkd7v76oiauI4fHH0d5bc',
    oneDriveApiKey: '000000004017206D'
} ;

// DropBox
var dropBoxOptions ={
    // Required. Called when a user selects an item in the Chooser.
    success: function (files) {
        //file ={
        //    name: "filename.txt",
        //    link: "https://...", // URL to access the file, which varies depending on the linkType specified
        //    bytes: 464, // Size of the file in bytes.
        //    icon: "https://...", // URL to a 64x64px icon for the file based on the file's extension.
        //    thumbnailLink: "https://...?bounding_box=75&mode=fit",
        //    isDir: false,
        //} ;
	    for ( var i =0 ; i < files.length ; i++ )
	        if ( !files [i].isDir )
		        uploadFile (files [i].link, files [i].name, files [i].bytes) ;
	        //else
	        //  uploadFolder (files [i].link) ;
    },

    // Optional. Called when the user closes the dialog without selecting a file
    // and does not include any parameters.
    cancel: function () {
    },

    // Optional. "preview" (default) is a preview link to the document for sharing,
    // "direct" is an expiring link to download the contents of the file. For more
    // information about link types, see Link types below.
    linkType: "direct", // "preview" or "direct"

    // Optional. A value of false (default) limits selection to a single file, while
    // true enables multiple file selection.
    multiselect: true, // false or true

    // Optional. This is a list of file extensions. If specified, the user will
    // only be able to select files with these extensions. You may also specify
    // file types, such as "video" or "images" in the list. For more information,
    // see File types below. By default, all extensions are allowed.
    //extensions: [ '.pdf', '.doc', '.docx' ],
} ;

function dropBoxInitialize (elt) {
    if ( elt )
        $(elt).click (function (evt) {
            evt.stopPropagation () ;
            Dropbox.choose (dropBoxOptions) ;
        }) ;
}

// Box
var boxOptions = {
    clientId: keys.boxApiKey,
    linkType: 'direct', // direct or shared
    multiselect: 'true' // true or false as string
} ;

function boxInitialize (elt) {
    if ( elt )
        $(elt).click (function (evt) {
            evt.stopPropagation () ;
            var boxSelect =new BoxSelect (boxOptions) ;
            boxSelect.success (function (response) {
                //[ {
                //    "url" : "https://app.box.com/s/jxi6hcwccjka6k8ewhi3",
                //    "name" : "Happy Hour GIFs",
                //    "access" : "collaborators",
                //    "type" : "folder", // or file
                //    "id" : 12965404694
                //} ]
	            for ( var i =0 ; i < response.length ; i++ )
	                if ( response [i].type !== 'folder' )
		                uploadFile (response [i].url, response [i].name, response [i].size) ;
	                //else
		            //    uploadFolder (response [i].url) ;
            }) ;
            boxSelect.cancel (function () {
                console.log ("The user clicked cancel or closed the popup") ;
            }) ;
            boxSelect.launchPopup () ;
        }) ;
}

// Google Drive
/*var googleOAuthToken ;

function onGoogleApiLoad () {
    // Use the API Loader script to load the Authentication script.
    gapi.load ('auth', { 'callback': onGoogleAuthApiLoad }) ;
    // Use the API Loader script to load the google.picker script.
    gapi.load ('picker', { 'callback': onGooglePickerApiLoad }) ;
}

function onGoogleAuthApiLoad () {
    window.gapi.auth.authorize (
        {
            'client_id': keys.gapiClientId,
            'scope': [ 'https://www.googleapis.com/auth/drive.readonly' ],
            'immediate': false
        },
        handleAuthResult
    ) ;
}

function onGooglePickerApiLoad () {
    var picker =new google.picker.PickerBuilder ()
        .addView (google.picker.ViewId.DOCS)
        .setOAuthToken (googleOAuthToken)
        .setDeveloperKey (keys.gapiKey)
        .setCallback (pickerCallback)
        .build () ;
    picker.setVisible (true) ;
}

function pickerCallback (data) {
    var url ='nothing' ;
    if ( data [google.picker.Response.ACTION] == google.picker.Action.PICKED ) {
        var doc =data [google.picker.Response.DOCUMENTS] [0] ;
        url =doc [google.picker.Document.URL] ;
    }
    var message ='You picked: ' + url ;
    //document.getElementById('result').innerHTML = message;
}
*/

function googleDriveInitialize (elt) {
    if ( elt )
        var picker =new FilePicker ({
            apiKey: keys.gapiKey,
            clientId: keys.gapiClientId,
            buttonEl: $(elt) [0],
            onSelect: function (file) {
                console.log (file) ;
                alert ('Selected ' + file.title) ;
            }
        }) ;
}

function googleDriveOnloadInit () {
    setTimeout (function () { googleDriveInitialize ("#gDrive") ; }, 1000) ;
}

// Inits
function loadersInitialize (dropboxElt, boxElt, gdriveElt) {
    dropBoxInitialize (dropboxElt) ;
    boxInitialize (boxElt) ;
    //googleDriveInitialize (gdriveElt) ; // onload
}

// Google Drive File Picker Example / By Daniel Lo Nigro (http://dan.cx/)
(function () {
    // Initialise a Google Driver file picker
    var FilePicker =window.FilePicker =function (options) {
        // Config
        this.apiKey =options.apiKey ;
        this.clientId =options.clientId ;
        // Elements
        this.buttonEl =options.buttonEl ;
        // Events
        this.onSelect =options.onSelect ;
        this.buttonEl.addEventListener ('click', this.open.bind (this)) ;
        // Disable the button until the API loads, as it won't work properly until then.
        this.buttonEl.disabled =true ;
        // Load the drive API
        gapi.client.setApiKey (this.apiKey) ;
        gapi.client.load ('drive', 'v2', this._driveApiLoaded.bind (this)) ;
        google.load ('picker', '1', { callback: this._pickerApiLoaded.bind (this) }) ;
    } ;

    FilePicker.prototype = {
        // Open the file picker.
        open: function () {
            // Check if the user has already authenticated
            var token =gapi.auth.getToken () ;
            if ( token ) {
                this._showPicker () ;
            } else {
                // The user has not yet authenticated with Google
                // We need to do the authentication before displaying the Drive picker.
                this._doAuth (false, function () { this._showPicker () ; }.bind (this)) ;
            }
        },

        // Show the file picker once authentication has been done.
        // @private
        _showPicker: function () {
            var accessToken =gapi.auth.getToken ().access_token ;
            this.picker =new google.picker.PickerBuilder ()
                .addView (google.picker.ViewId.DOCUMENTS)
                .setAppId (this.clientId)
                .setOAuthToken (accessToken)
                .setCallback (this._pickerCallback.bind (this))
                .build ()
                .setVisible (true) ;
        },

        // Called when a file has been selected in the Google Drive file picker.
        // @private
        _pickerCallback: function (data) {
            if ( data [google.picker.Response.ACTION] == google.picker.Action.PICKED ) {
                var file =data [google.picker.Response.DOCUMENTS] [0] ;
                var id =file [google.picker.Document.ID] ;
                var request =gapi.client.drive.files.get ({ fileId: id }) ;
                request.execute (this._fileGetCallback.bind (this)) ;
            }
        },

        // Called when file details have been retrieved from Google Drive.
        // @private
        _fileGetCallback: function (file) {
            if ( this.onSelect )
                this.onSelect (file) ;
        },

        // Called when the Google Drive file picker API has finished loading.
        // @private
        _pickerApiLoaded: function () {
            this.buttonEl.disabled =false ;
        },

        // Called when the Google Drive API has finished loading.
        // @private
        _driveApiLoaded: function () {
            this._doAuth (true) ;
        },

        // Authenticate with Google Drive via the Google JavaScript API.
        // @private
        _doAuth: function (immediate, callback) {
            gapi.auth.authorize ({
                    client_id: this.clientId /*+ '.apps.googleusercontent.com'*/,
                    scope: 'https://www.googleapis.com/auth/drive.readonly',
                    immediate: immediate
                },
                callback
            ) ;
        },

        downloadFile: function (file, callback) {
            if ( file.downloadUrl ) {
                var accessToken =gapi.auth.getToken ().access_token ;
                var xhr =new XMLHttpRequest () ;
                xhr.open ('GET', file.downloadUrl) ;
                xhr.setRequestHeader ('Authorization', 'Bearer ' + accessToken) ;
                xhr.onload =function () {
                    callback (xhr.responseText) ;
                } ;
                xhr.onerror =function () {
                    callback (null) ;
                } ;
                xhr.send () ;
            } else {
                callback (null) ;
            }
        }

    } ;

} ()) ;

String.prototype.hashCode =function () {
	var hash =0, i, chr, len ;
	if ( this.length === 0 )
		return (hash) ;
	for ( i =0, len =this.length ; i < len; i++ ) {
		chr =this.charCodeAt (i) ;
		hash =((hash << 5) - hash) + chr ;
		hash |=0 ; // Convert to 32bit integer
	}
	return (hash) ;
} ;
