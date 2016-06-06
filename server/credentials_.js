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
var config ={
	credentials: {
		// Replace placeholder below by the Consumer Key and Consumer Secret you got from
		// http://developer.autodesk.com/ for the production server
		client_id: process.env.CONSUMERKEY || '<replace with your consumer key>',
		client_secret: process.env.CONSUMERSECRET || '<replace with your consumer secret>',
		grant_type: 'client_credentials'
	},

	// If you which to use the Autodesk Forge Viewre on the staging server, change this url
	BaseEndPoint: 'https://developer.api.autodesk.com',
	Version: 'v1',
	bucket: 'extract-autodesk-io-2016',
	mailTo: '',

	MAILJET1: process.env.MAILJET1 || '<replace with your mailjet consumer key>',
	MAILJET2: process.env.MAILJET2 || '<replace with your mailjet consumer secret>'
} ;

// Comment out this line if you want in case you changed the bucket name at line #33 to a unique name
config.bucket =config.bucket + config.credentials.client_id.toLowerCase () ;

config.AuthenticateEndPoint =config.BaseEndPoint + '/authentication/' + config.Version + '/authenticate' ;

config.getBucketsDetailsEndPoint =config.BaseEndPoint + '/oss/' + config.Version + '/buckets/%s/details' ;
config.postBucketsEndPoint =config.BaseEndPoint + '/oss/' + config.Version + '/buckets' ;
config.putFileUploadEndPoint =config.BaseEndPoint + '/oss/' + config.Version + '/buckets/%s/objects/%s' ;
config.putFileUploadResumableEndPoint =config.BaseEndPoint + '/oss/' + config.Version + '/buckets/%s/objects/%s/resumable' ;
config.fileResumableChunk =40 ; // in Mb
config.getFileDetailsEndPoint =config.BaseEndPoint + '/oss/' + config.Version + '/buckets/%s/objects/%s/details' ;

config.postSetReferencesEndPoint =config.BaseEndPoint + '/references/' + config.Version + '/setreference' ;

config.postRegisterEndPoint =config.BaseEndPoint + '/viewingservice/' + config.Version + '/register' ;
config.getBubblesEndPoint =config.BaseEndPoint + '/viewingservice/' + config.Version + '/%s' ;
config.getStatusEndPoint =config.getBubblesEndPoint + '/status' ;
config.getAllEndPoint =config.getBubblesEndPoint + '/all' ;
config.getItemsEndPoint =config.BaseEndPoint + '/viewingservice/' + config.Version + '/items/%s' ;
config.getThumbnailsEndPoint =config.BaseEndPoint + '/viewingservice/' + config.Version + '/thumbnails/%s' ;

module.exports =config ;