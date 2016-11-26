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

// config.BaseEndPoint
var viewer =[
	'viewer3D.min.js',
	'style.css',
	'three.min.js',
	'lmvworker.min.js',
] ;

// res/environments/
var environments =[
	'CoolLight_irr.logluv.dds',
	'CoolLight_mipdrop.logluv.dds',
	'DarkSky_irr.logluv.dds',
	'DarkSky_mipdrop.logluv.dds',
	'GreyRoom_irr.logluv.dds',
	'GreyRoom_mipdrop.logluv.dds',
	'GridLight_irr.logluv.dds',
	'GridLight_mipdrop.logluv.dds',
	'IDViz_irr.logluv.dds',
	'IDViz_mipdrop.logluv.dds',
	'InfinityPool_irr.logluv.dds',
	'InfinityPool_mipdrop.logluv.dds',
	'PhotoBooth_irr.logluv.dds',
	'PhotoBooth_mipdrop.logluv.dds',
	'Plaza_irr.logluv.dds',
	'Plaza_mipdrop.logluv.dds',
	'Reflection_irr.logluv.dds',
	'Reflection_mipdrop.logluv.dds',
	'RimHighlights_irr.logluv.dds',
	'RimHighlights_mipdrop.logluv.dds',
	'SharpHighlights_irr.logluv.dds',
	'SharpHighlights_mipdrop.logluv.dds',
	'SnowField_irr.logluv.dds',
	'SnowField_mipdrop.logluv.dds',
	'SoftLight_irr.logluv.dds',
	'SoftLight_mipdrop.logluv.dds',
	'TranquilityBlue_irr.logluv.dds',
	'TranquilityBlue_mipdrop.logluv.dds',
	'WarmLight_irr.logluv.dds',
	'WarmLight_mipdrop.logluv.dds',
	'boardwalk_irr.logluv.dds',
	'boardwalk_mipdrop.logluv.dds',
	'crossroads_irr.logluv.dds',
	'crossroads_mipdrop.logluv.dds',
	'field_irr.logluv.dds',
	'field_mipdrop.logluv.dds',
	'glacier_irr.logluv.dds',
	'glacier_mipdrop.logluv.dds',
	'riverbank_irr.logluv.dds',
	'riverbank_mipdrop.logluv.dds',
	'seaport_irr.logluv.dds',
	'seaport_mipdrop.logluv.dds'
] ;
environments =environments.map (function (elt) { return ('res/environments/' + elt) ; }) ;

// res/textures/
var textures =[
	'VCarrows.png',
	'VCarrowsS0.png',
	'VCarrowsS1.png',
	'VCcontext.png',
	'VCcontextS.png',
	'VCedge1.png',
	'VChome.png',
	'VChomeS.png',
	'cardinalPoint.png',
	'centerMarker_X.png',
	'radial-fade-grid.png'
] ;
textures =textures.map (function (elt) { return ('res/textures/' + elt) ; }) ;

// res/locales
var locales =[ 'cs', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt-BR', 'ru', 'tr', 'zh-HANS', 'zh-HANT' ] ;
// res/locales/[locales]/
var localesJson =[
	'allstrings.json',
	//'VCcross.dds',
	//'VCcross.png',
	'VCcrossRGBA8small.dds'
] ;

locales =locales.reduce (
	function (prev, elt, index, arr) {
		return (prev.concat (
			localesJson.map (function (elt2) {
				return ('res/locales/' + elt + '/' + elt2) ;
			})
		)) ;
	},
	[]
) ;

//-
module.exports =viewer
	.concat (environments)
	.concat (textures)
	.concat (locales) ;
