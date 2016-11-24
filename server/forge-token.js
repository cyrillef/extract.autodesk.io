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
var fs =require ('fs') ;
var ForgeSDK =require ('forge-apis') ;
var config =require ('./config') ;
var utils =require ('./utils') ;

var oAuth2TwoLegged =null ;
var refreshToken =function (credentials) {
	credentials =credentials || config.credentials ;
	if ( oAuth2TwoLegged == null )
		oAuth2TwoLegged =new ForgeSDK.AuthClientTwoLegged (credentials.client_id, credentials.client_secret, credentials.scope) ;
	oAuth2TwoLegged.authenticate ()
		.then (function (response) {
			console.log ('Token: ' + response.access_token) ;
			oAuth2TwoLegged.setCredentials (response) ;
			setTimeout (refreshToken, (response.expires_in - 300) * 1000) ; // - 5 minutes
			utils.writeFile (utils.data ('token'), response)
				.catch (function (err) {
					throw err ;
				}) ;
		})
		.catch (function (error) {
			setTimeout (refreshToken, 2000) ; // Try again
			utils.unlink (utils.data ('token')) ;
			console.error ('Token: ERROR! ', error) ;
		})
	;
	return (oAuth2TwoLegged) ;
} ;

var oAuth2TwoLeggedRO =null ;
var refreshTokenRO =function (credentials) {
	credentials =credentials || config.credentials ;
	if ( oAuth2TwoLeggedRO == null )
		oAuth2TwoLeggedRO =new ForgeSDK.AuthClientTwoLegged (credentials.client_id, credentials.client_secret, [ 'data:read' ]) ;
	oAuth2TwoLeggedRO.authenticate ()
		.then (function (response) {
			console.log ('Token RO: ' + response.access_token) ;
			oAuth2TwoLeggedRO.setCredentials (response) ;
			setTimeout (refreshTokenRO, (response.expires_in - 300) * 1000) ; // - 5 minutes
			utils.writeFile (utils.data ('tokenRO'), response)
				.catch (function (err) {
					throw err ;
				}) ;
		})
		.catch (function (error) {
			setTimeout (refreshTokenRO, 2000) ; // Try again
			utils.unlink (utils.data ('tokenRO')) ;
			console.log ('Token RO: ERROR!', error) ;
		})
	;
	return (oAuth2TwoLeggedRO) ;
} ;

module.exports ={
	RW: refreshToken (),
	RO: refreshTokenRO ()
} ;
