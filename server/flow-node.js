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
var Stream =require ('stream').Stream ;

module.exports =flow =function (temporaryFolder) {
    var $ =this ;
    $.temporaryFolder =temporaryFolder ;
    $.maxFileSize =null ;
    $.fileParameterName ='file' ;

    try {
        fs.mkdirSync ($.temporaryFolder) ;
    } catch ( e ) {
    }

    function cleanIdentifier (identifier) {
        return (identifier.replace (/[^0-9A-Za-z_-]/g, '')) ;
    }

    function getChunkFilename (chunkNumber, identifier) {
        // Clean up the identifier
        identifier =cleanIdentifier (identifier) ;
        // What would the file name be?
        return (path.resolve ($.temporaryFolder, './flow-' + identifier + '.' + chunkNumber)) ;
    }

    function validateRequest (chunkNumber, chunkSize, totalSize, identifier, filename, fileSize) {
        identifier =cleanIdentifier (identifier) ; // Clean up the identifier
        // Check if the request is sane
        if ( chunkNumber === 0 || chunkSize === 0 || totalSize === 0 || identifier.length === 0 || filename.length === 0 )
            return ('non_flow_request') ;
        var numberOfChunks =Math.max (Math.floor (totalSize / (chunkSize * 1.0)), 1) ;
        if ( chunkNumber > numberOfChunks )
            return ('invalid_flow_request1') ;
        if ( $.maxFileSize && totalSize > $.maxFileSize )
            return ('invalid_flow_request2') ; // The file is too big
        if ( typeof (fileSize) != 'undefined' ) {
            if ( chunkNumber < numberOfChunks && fileSize != chunkSize )
                return ('invalid_flow_request3') ; // The chunk in the POST request isn't the correct size
            if ( numberOfChunks > 1 && chunkNumber == numberOfChunks && fileSize != ((totalSize % chunkSize) + parseInt(chunkSize)) )
                return ('invalid_flow_request4') ; // The chunks in the POST is the last one, and the fil is not the correct size
            if ( numberOfChunks == 1 && fileSize != totalSize )
                return ('invalid_flow_request5') ; // The file is only a single chunk, and the data size does not fit
        }
        return ('valid') ;
    }

    // 'found', filename, original_filename, identifier, totalSize
    // 'not_found', null, null, null, null
    $.get =function (req, callback) {
        var chunkNumber =req.param ('flowChunkNumber', 0) ;
        var chunkSize =req.param ('flowChunkSize', 0) ;
        var totalSize =req.param ('flowTotalSize', 0) ;
        var identifier =req.param ('flowIdentifier', "") ;
        var filename =req.param ('flowFilename', "") ;
        if ( validateRequest (chunkNumber, chunkSize, totalSize, identifier, filename) == 'valid' ) {
            var chunkFilename =getChunkFilename (chunkNumber, identifier) ;
            fs.exists (chunkFilename, function (exists) {
                if ( exists )
                    callback ('found', chunkFilename, filename, identifier, totalSize) ;
                else
                    callback ('not_found', null, null, null, null) ;
            }) ;
        } else {
            callback ('not_found', null, null, null, null) ;
        }
    } ;

    // 'partly_done', filename, original_filename, identifier, totalSize
    // 'done', filename, original_filename, identifier, totalSize
    // 'invalid_flow_request', null, null, null, null
    // 'non_flow_request', null, null, null, null
    $.post =function (req, callback) {
        var fields =req.body ;
        var files =req.files ;
        var chunkNumber =fields.flowChunkNumber ;
        var chunkSize =fields.flowChunkSize ;
        var totalSize =fields.flowTotalSize ;
        var identifier =cleanIdentifier (fields.flowIdentifier) ;
        var filename =fields.flowFilename ;
        if ( !files [$.fileParameterName] || !files [$.fileParameterName].size ) {
            callback ('invalid_flow_request', null, null, null, null) ;
            return ;
        }

        var original_filename =files [$.fileParameterName].originalFilename ;
        var validation =validateRequest (chunkNumber, chunkSize, totalSize, identifier, filename, files [$.fileParameterName].size) ;
        if ( validation == 'valid' ) {
            var chunkFilename =getChunkFilename (chunkNumber, identifier) ;
            // Save the chunk (TODO: OVERWRITE)
            fs.rename (files [$.fileParameterName].path, chunkFilename, function () {
                // Do we have all the chunks?
                var currentTestChunk =1 ;
                var numberOfChunks =Math.max (Math.floor (totalSize / (chunkSize * 1.0)), 1) ;
                var testChunkExists =function () {
                    fs.exists (getChunkFilename (currentTestChunk, identifier), function (exists) {
                        if ( exists ) {
                            currentTestChunk++ ;
                            if ( currentTestChunk > numberOfChunks )
                                callback ('done', filename, original_filename, identifier, totalSize);
                            else // Recursion
                                testChunkExists () ;
                        } else {
                            callback ('partly_done', filename, original_filename, identifier, totalSize) ;
                        }
                    }) ;
                } ;
                testChunkExists () ;
            }) ;
        } else {
            callback (validation, filename, original_filename, identifier, totalSize) ;
        }
    } ;

    // Pipe chunks directly in to an existsing WritableStream
    //   r.write(identifier, response);
    //   r.write(identifier, response, {end:false});
    //
    //   var stream = fs.createWriteStream(filename);
    //   r.write(identifier, stream);
    //   stream.on('data', function(data){...});
    //   stream.on('finish', function(){...});
    $.write =function (identifier, writableStream, options) {
        options =options || {} ;
        options.end =(typeof options.end === 'undefined' ? true : options.end) ;
        // Iterate over each chunk
        var pipeChunk =function (number) {
            var chunkFilename =getChunkFilename (number, identifier) ;
            fs.exists (chunkFilename, function (exists) {
                if ( exists ) {
                    // If the chunk with the current number exists,
                    // then create a ReadStream from the file
                    // and pipe it to the specified writableStream.
                    var sourceStream =fs.createReadStream (chunkFilename) ;
                    sourceStream.pipe (writableStream, { end: false }) ;
                    sourceStream.on ('end', function () {
                        // When the chunk is fully streamed, jump to the next one
                        pipeChunk (number + 1) ;
                    }) ;
                } else {
                    // When all the chunks have been piped, end the stream
                    if ( options.end )
                        writableStream.end () ;
                    if ( options.onDone )
                        options.onDone () ;
                }
            }) ;
        } ;
        pipeChunk (1) ;
    } ;

    $.clean =function (identifier, options) {
        options =options || {} ;
        // Iterate over each chunk
        var pipeChunkRm =function (number) {
            var chunkFilename =getChunkFilename (number, identifier) ;
            //console.log('removing pipeChunkRm ', number, 'chunkFilename', chunkFilename);
            fs.exists (chunkFilename, function (exists) {
                if ( exists ) {
                    //console.log('exist removing ', chunkFilename);
                    fs.unlink (chunkFilename, function (err) {
                        if ( err && options.onError )
                            options.onError (err) ;
                    }) ;
                    pipeChunkRm (number + 1) ;
                } else {
                    if ( options.onDone )
                        options.onDone () ;
                }
            }) ;
        } ;
        pipeChunkRm (1) ;
    } ;

    return ($) ;
} ;
