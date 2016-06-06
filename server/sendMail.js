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
var express =require ('express') ;
var request =require ('request') ;
var Mailjet =require ('mailjet-sendemail') ;
var config =(require ('fs').existsSync ('server/credentials.js') ?
	require ('./credentials')
	: (console.log ('No credentials.js file present, assuming using CONSUMERKEY & CONSUMERSECRET system variables.'), require ('./credentials_'))) ;

function sendMail1 (mail) {
	mail.to =mail.to || config.mailTo ;
	if ( config.MAILJET1 === '<replace with your mailjet consumer key>' || mail.to === '' )
		return ;
	var mjet =new Mailjet (config.MAILJET1, config.MAILJET2) ;
	mjet.sendContent (
		mail.from,
		mail.to,
		mail.subject,
		'html',
		mail.html
	) ;
}

module.exports =sendMail1 ;
