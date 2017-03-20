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
var fs =require ('fs') ;
var path =require ('path') ;
var util =require ('util') ;
var moment =require ('moment') ;
var AdmZip =require ('adm-zip') ;
var utils =require ('./utils') ;
var ForgeSDK =require ('forge-apis') ;
var config =require ('./config') ;
var forgeToken =require ('./forge-token') ;

module.exports =flow =function () {
    var $ =this ;
    $.maxFileSize =null ;
    $.files ={} ;
    $.times ={} ;
	$.sessionsId ={} ;

    function cleanIdentifier (identifier) {
        return (identifier.replace (/[^0-9A-Za-z_-]/g, '')) ;
    }

    function validateRequest (chunkNumber, chunkSize, totalSize, identifier, filename, fileSize) {
        identifier =cleanIdentifier (identifier) ; // Clean up the identifier
        // Check if the request is sane
        if ( chunkNumber === 0 || chunkSize === 0 || totalSize === 0 || identifier.length === 0 || filename.length === 0 )
            return ('non_flow_request') ;
        var numberOfChunks =Math.max (Math.ceil (totalSize / (chunkSize * 1.0)), 1) ;
        if ( chunkNumber > numberOfChunks )
            return ('invalid_flow_request1') ;
        if ( $.maxFileSize && totalSize > $.maxFileSize )
            return ('invalid_flow_request2') ; // The file is too big
        if ( typeof (fileSize) != 'undefined' ) {
            if ( chunkNumber < numberOfChunks && fileSize != chunkSize )
                return ('invalid_flow_request3') ; // The chunk in the POST request isn't the correct size
            if ( numberOfChunks > 1 && chunkNumber == numberOfChunks && fileSize != (totalSize % chunkSize) )
                return ('invalid_flow_request4') ; // The chunks in the POST is the last one, and the file is not the correct size
            if ( numberOfChunks == 1 && fileSize != totalSize )
                return ('invalid_flow_request5') ; // The file is only a single chunk, and the data size does not fit
        }
        return ('valid') ;
    }

	function objectToOSS (identifier, fnname, buffer) {
		return (new Promise (function (fulfill, reject) {
			var ObjectsApi =new ForgeSDK.ObjectsApi () ;
			ObjectsApi.uploadObject (config.bucket, fnname, buffer.length, buffer, {}, forgeToken.RW, forgeToken.RW.getCredentials ())
				.then (function (response) {
					response.body.key =identifier ;
					return (utils.writeFile (utils.data (identifier), response.body)) ;
				})
				.then (function (content) {
					fulfill (content) ;
				})
				.catch (function (error) {
					reject (error) ;
				}) ;
		})) ;
	} ;

	function resumableToOSS (identifier, fnname, buffer, contentRange, sessionId) {
		return (new Promise (function (fulfill, reject) {
			var ObjectsApi =new ForgeSDK.ObjectsApi () ;
			ObjectsApi.uploadChunk (config.bucket, fnname, buffer.length, contentRange, sessionId, buffer, {}, forgeToken.RW, forgeToken.RW.getCredentials ())
				.then (function (response) {
					response.body.key =identifier ;
					return (utils.writeFile (utils.data (identifier), response.body)) ;
				})
				.then (function (content) {
					fulfill (content) ;
				})
				.catch (function (error) {
					reject (error) ;
				}) ;
		})) ;
	} ;

    // 'partly_done', filename, original_filename, identifier, totalSize
    // 'done', filename, original_filename, identifier, totalSize
    // 'invalid_flow_request', null, null, null, null
    // 'non_flow_request', null, null, null, null
    $.post =function (req, callback) {
        var fields =req.body ;
        var chunkNumber =parseInt (fields.flowChunkNumber) ;
        var chunkSize =parseInt (fields.flowChunkSize) ;
        var totalSize =parseInt (fields.flowTotalSize) ;
        var identifier =cleanIdentifier (fields.flowIdentifier) ;
        var filename =fields.flowFilename ;
		var files =req.file ;
        if ( !files || !files.size || !files.originalname )
            return (callback ('invalid_flow_request', null, null, null, null)) ;

        var original_filename =files.originalname ;
        var validation =validateRequest (chunkNumber, chunkSize, totalSize, identifier, filename, files.size) ;
        if ( validation !== 'valid' )
        	return (callback (validation, filename, original_filename, identifier, totalSize)) ;

		var numberOfChunks =Math.max (Math.ceil (totalSize / (chunkSize * 1.0)), 1) ;
		$.storeFile (identifier, original_filename, chunkNumber, numberOfChunks) ; //, files.buffer) ;

		if ( numberOfChunks === 1 ) {
			objectToOSS (identifier, original_filename, files.buffer)
				.then (function (response) {
					$.files [identifier] [0] =files.buffer ;
					var entries =$.exploreZip (identifier, original_filename) ;
					callback ('done', filename, original_filename, identifier, totalSize, entries, response) ;
				})
				.catch (function (error) {
					console.error (error) ;
					callback ('invalid_flow_request', null, null, null, null) ;
				}) ;
		} else {
			var start =(chunkNumber - 1) * chunkSize ;
			var end =start + parseInt (fields.flowCurrentChunkSize) - 1 ;
			var contentRange ='bytes ' + start + '-' + end + '/' + totalSize ;
			//console.log ($.sessionsId [identifier], contentRange, files.buffer.length) ;
			resumableToOSS (identifier, original_filename, files.buffer, contentRange, $.sessionsId [identifier])
			 	.then (function (response) {
					$.files [identifier] [chunkNumber - 1] =files.buffer ;
					if ( chunkNumber === numberOfChunks ) {
						function waitForAllChunkUpload () {
							var bComplete =$.isFileComplete (identifier, numberOfChunks) ;
							if ( !bComplete )
								//return (process.nextTick (waitForAllChunkUpload)) ;
								return (setTimeout (waitForAllChunkUpload, 500)) ;
							var entries =$.exploreZip (identifier, original_filename) ;
							callback ('done', filename, original_filename, identifier, totalSize, entries, response) ;
						}
						waitForAllChunkUpload () ;
					} else {
						callback ('partly_done', filename, original_filename, identifier, totalSize) ;
					}
			 	})
			 	.catch (function (error) {
			 		console.error (error) ;
					callback ('invalid_flow_request', null, null, null, null) ;
			 	}) ;
		}
	} ;

	// 'found', original_filename, identifier, totalSize
	// 'not_found', null, null, null
	$.get =function (req, callback) {
		var chunkNumber =req.param ('flowChunkNumber', 0) ;
		var chunkSize =req.param ('flowChunkSize', 0) ;
		var totalSize =req.param ('flowTotalSize', 0) ;
		var identifier =req.param ('flowIdentifier', '') ;
		var filename =req.param ('flowFilename', '') ;
		if ( validateRequest (chunkNumber, chunkSize, totalSize, identifier, filename) === 'valid' ) {
			if ( $.files.hasOwnProperty (identifier) && $.files [identifier] [chunkNumber] !== undefined )
				callback ('found', filename, identifier, totalSize) ;
			else
				callback ('not_found', null, null, null) ;
		} else {
			callback ('not_found', null, null, null) ;
		}
	} ;

	$.storeFile =function (identifier, original_filename, chunkNumber, numberOfChunks, chunk) {
		if ( !$.files.hasOwnProperty (identifier) ) {
			$.files [identifier] =new Array (numberOfChunks) ;
			$.times [identifier] =moment () ;
			$.sessionsId [identifier] =/*identifier +*/ utils.symbol () ;
		}
		if ( !utils.isCompressed (original_filename) && chunk !== undefined )
			$.files [identifier] [chunkNumber - 1] =true ; // If this is not a zip, we do not need to store the chunk
		else if ( chunk !== undefined )
		 	$.files [identifier] [chunkNumber - 1] =chunk ;
	} ;

	$.isFileComplete =function (identifier, numberOfChunks) {
		if ( !$.files.hasOwnProperty (identifier) )
			return (false) ;
		for ( var i =0 ; i < numberOfChunks && $.files [identifier] [i] !== undefined ; i++ ) ;
		return (i === numberOfChunks) ;
	} ;

    $.exploreZip =function (identifier, original_filename) {
		var entries =[] ;
		if ( utils.isCompressed (original_filename) && $.files.hasOwnProperty (identifier) ) {
			$.files [identifier] =Buffer.concat ($.files [identifier]) ;
			var zip =new AdmZip ($.files [identifier]) ;
			zip.getEntries ().forEach (function (zipEntry) {
				//console.log (zipEntry.toString ()) ;
				if ( zipEntry.isDirectory === false )
					entries.push (zipEntry.entryName) ;
			}) ;
		}
		$.clean (identifier) ;
		return (entries) ;
	} ;

    $.clean =function (identifier) {
    	if ( $.files.hasOwnProperty (identifier) )
    		delete $.files [identifier] ;
		if ( $.times.hasOwnProperty (identifier) )
			delete $.times [identifier] ;
		if ( $.sessionsId.hasOwnProperty (identifier) )
			delete $.sessionsId [identifier] ;
	} ;

    $.autoClean =function () {
		for ( var key in $.times ) {
			if ( !$.times.hasOwnProperty (key) )
				continue ;
			if ( moment.duration (moment ().diff ($.times [key])).asHours () > 1.0 || !$.files.hasOwnProperty (key) )
				$.clean (key) ;
		}
	}

	// Start auto-cleaning
	setInterval (function () { $.autoClean () ; }, 20 * 60 * 1000) ; // every 20 minutes

    return ($) ;
} ;
