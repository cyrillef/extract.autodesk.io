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
var crypto =require ('crypto') ;

var config ={
	credentials: {
		// Replace placeholder below by the Consumer Key and Consumer Secret you got from
		// http://developer.autodesk.com/ for the production server
		client_id: process.env.FORGE_CLIENT_ID || '<replace with your consumer key>',
		client_secret: process.env.FORGE_CLIENT_SECRET || '<replace with your consumer secret>',
		grant_type: 'client_credentials',
		scope: [ 'data:read', 'data:write', 'bucket:read', 'bucket:create' ]
	},

	bucket: 'extract-autodesk-io-2017',
	mailTo: '',

	MJ_APIKEY_PUBLIC: process.env.MJ_APIKEY_PUBLIC || '<replace with your mailjet public key>',
	MJ_APIKEY_PRIVATE: process.env.MJ_APIKEY_PRIVATE || '<replace with your mailjet private key>',
	MJ_ACCOUNT : process.env.MJ_ACCOUNT || '<replace with your mailjet account name>'

} ;

// Make sure it is a unique bucket name by using the public key
var md5sum =crypto.createHash ('md5').update (config.bucket).digest ('hex') ;
if ( md5sum !== '37e06274b75aa068cf2d40af85248953' )
	config.bucket +=config.client_id.toLocaleString () ;

module.exports =config ;