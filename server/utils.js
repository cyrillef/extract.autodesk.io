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
var rimraf =require ('rimraf') ;
var mkdirp =require ('mkdirp') ;

var utils ={

	path: function (pathname) {
		return (path.normalize (__dirname + '/../' + pathname)) ;
	},

	data: function (name) {
		return (path.normalize (__dirname + '/../data/' + name + '.json')) ;
	},

	extracted: function (name) {
		return (path.normalize (__dirname + '/../www/extracted/' + name)) ;
	},

	readFile: function (filename, enc) {
		return (new Promise (function (fulfill, reject) {
			fs.readFile (filename, enc, function (err, res) {
				if ( err )
					reject (err) ;
				else
					fulfill (res) ;
			}) ;
		})) ;
	},

	writeFile: function (filename, content, enc, bRaw) {
		return (new Promise (function (fulfill, reject) {
			var pathname =path.dirname (filename) ;
			utils.mkdirp (pathname)
				.then (function (pathname) {
					fs.writeFile (filename, !bRaw && typeof content !== 'string' ? JSON.stringify (content) : content, enc, function (err) {
						if ( err )
							reject (err) ;
						else
							fulfill (content) ;
					}) ;
				})
			;
		})) ;
	},

	json: function (name) {
		var filename =path.normalize (__dirname + '/../data/' + name + '.json') ;
		return (new Promise (function (fulfill, reject) {
			utils.readFile (filename, 'utf8')
				.then (function (res) {
					try {
						fulfill (JSON.parse (res)) ;
					} catch ( ex ) {
						console.error (ex.message, name) ;
						reject (ex) ;
					}
				}, reject) ;
			})
		) ;
	},

	filesize: function (filename) {
		return (new Promise (function (fulfill, reject) {
			fs.stat (filename, function (err, stat) {
				if ( err )
					reject (err) ;
				else
					fulfill (stat.size) ;
			}) ;
		})) ;
	},

	fileexists: function (filename) {
		return (new Promise (function (fulfill, reject) {
			fs.stat (filename, function (err, stat) {
				if ( err ) {
					if ( err.code === 'ENOENT' )
						fulfill (false) ;
					else
						reject (err) ;
				} else {
					fulfill (true) ;
				}
			}) ;
		})) ;
	},

	unlink: function (filename) {
		return (new Promise (function (fulfill, reject) {
			fs.stat (filename, function (err, stat) {
				if ( err ) {
					if ( err.code === 'ENOENT' )
						fulfill (false) ;
					else
						reject (err) ;
				} else {
					fs.unlink (filename, function (err) {}) ;
					fulfill (true) ;
				}
			}) ;
		})) ;
	},

	isCompressed: function (filename) {
		return (   path.extname (filename).toLowerCase () == '.zip'
				|| path.extname (filename).toLowerCase () == '.rar'
				|| path.extname (filename).toLowerCase () == '.gz'
		) ;
	},

	safeBase64encode: function (st) {
		return (new Buffer (st).toString ('base64')
			.replace (/\+/g, '-') // Convert '+' to '-'
			.replace (/\//g, '_') // Convert '/' to '_'
			.replace (/=+$/, '')
		) ;
	},

	safeBase64decode: function (base64) {
		// Add removed at end '='
		base64 +=Array (5 - base64.length % 4).join('=') ;
		base64 =base64
			.replace (/\-/g, '+')   // Convert '-' to '+'
			.replace (/\_/g, '/') ; // Convert '_' to '/'
		return (new Buffer (base64, 'base64').toString ()) ;
	},

	readdir: function (pathname) {
		return (new Promise (function (fulfill, reject) {
			fs.readdir (pathname, function (err, files) {
				if ( err )
					reject (err) ;
				else
					fulfill (files) ;
			}) ;
		})) ;
	},

	rimraf: function (pathname) {
		return (new Promise (function (fulfill, reject) {
			rimraf (pathname, function (err) {
				if ( err )
					reject (err) ;
				else
					fulfill (pathname) ;
			}) ;
		})) ;
	},

	mkdirp: function (pathname) {
		return (new Promise (function (fulfill, reject) {
			mkdirp (pathname, function (err) {
				if ( err )
					reject (err) ;
				else
					fulfill (pathname) ;
			}) ;
		})) ;
	},

	checkHost: function (req, domain) {
		//return ( domain === '' || req.headers.referer === domain ) ;
		return (true) ;
	}

} ;

module.exports =utils ;
