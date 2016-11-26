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

//var mocha =require ('mocha') ;
//var expect =require ('Chai').expect ;
//var request =require ('request') ;
var request =require ('supertest') ;
var should =require ('should') ;
var app =require ('../server/server') ;
var _config =require ('../server/config.js') ;
var fs =require ('fs') ;
var path =require ('path') ;
app.set ('port', process.env.PORT || 8000) ;

describe ('Starting Test server...', function () {

	var server ;
	var port =app.get ('port') ;
	//var url ='http://localhost:' + port ;

	var auObjFile ='samples/Au.obj' ;
	var auObjIdentifier ='1866-Auobj' ;
	var auObjBucket =_config.bucket ; /* transient */
	//var transientAuObjUrn ='urn:adsk.objects:os.object:' + auObjBucket + '/' + path.basename (auObjFile) ;

	// Start/End test server
	before (function (done) {
		console.log ('Starting server listening on port ' + app.get ('port')) ;
		this.timeout (12000) ;
		if ( fs.existsSync ('data/token.json') )
			fs.unlinkSync ('data/token.json') ;
		if ( fs.existsSync ('data/tokenRO.json') )
			fs.unlinkSync ('data/tokenRO.json') ;
		auObjIdentifier =fs.statSync (auObjFile).size + '-Auobj' ;

		server =app.listen (port, function () {
			console.log ('Server listening on port ' + server.address ().port) ;
			setTimeout (done, 6000) ;
		}) ;
	}) ;

	after (function () {
		server.close () ;
	}) ;

	// Tests
	describe ('Setup & token module', function () {
		/*before (function (done) {
			// We need to give time to refresh the token
			this.timeout (10000) ;
			setTimeout (done, 6000) ;
		}) ;
		*/
		it('server/config.js present', function (done) {
			fs.exists ('server/config.js', function (exists) {
				exists.should.be.equal (true) ;
				done () ;
			}) ;
		}) ;

		it('server/config.js with no valid keys', function (done) {
			fs.readFile ('server/config.js', 'utf8', function (err, content) {
				should.not.exist (err) ;
				content.indexOf ('<replace with your consumer key>').should.be.not.equal (-1) ;
				content.indexOf ('<replace with your consumer secret>').should.be.not.equal (-1) ;
				content.indexOf ('<replace with your mailjet public key>').should.be.not.equal (-1) ;
				content.indexOf ('<replace with your mailjet private key>').should.be.not.equal (-1) ;
				content.indexOf ('<replace with your mailjet account name>').should.be.not.equal (-1) ;
				done () ;
			}) ;
		}) ;

		it('data/token.json', function (done) {
			fs.readFile ('data/token.json', 'utf8', function (err, content) {
				should.not.exist (err) ;
				done () ;
			}) ;
		}) ;

	}) ;

	describe ('file module', function () {
		var fileEP ='/api/file' ;

		it('(post) ' + fileEP + ' - post a file to the app', function (done) {
			this.timeout (5000) ;
			var stats =fs.statSync (auObjFile) ;
			request (app)
				.post (fileEP)
				.expect (200) //, done)
				.field ('flowChunkNumber', '1')
				.field ('flowChunkSize', '1048576')
				.field ('flowCurrentChunkSize', stats ['size'])
				.field ('flowTotalSize', stats ['size'])
				.field ('flowIdentifier', auObjIdentifier)
				.field ('flowFilename', path.basename (auObjFile))
				.field ('flowRelativePath', path.basename (auObjFile))
				.field ('flowTotalChunks', '1')
				.attach ('file', auObjFile)
				//.expect (function (res) {})
				.end (function (err, res) {
					if ( err )
						throw err ;
					res.status.should.equal (200) ;
					done () ;
				}) ;
			}) ;

	}) ;

	describe ('projects module', function () {
		var projectsEP ='/api/projects' ;

		it('(post) ' + projectsEP + ' - post file to oss and requested translation', function (done) {
			request (app)
				.post (projectsEP)
				.send ({ 'uniqueIdentifier': auObjIdentifier, 'children': [ auObjIdentifier ] })
				.expect (200) //, done)
				.expect ('Content-Type', /json/)
				.expect ({ 'uniqueIdentifier': auObjIdentifier, 'children': [ auObjIdentifier ] }, done) ;
		}) ;

	}) ;

	describe ('projects module (part-2)', function () {
		var projectsEP ='/api/projects' ;

		before (function (done) {
			// We need to give time to oss upload
			this.timeout (12000) ;
			setTimeout (done, 10000) ;
		}) ;

		it('(get) ' + projectsEP + '/:identifier/progress - get translation progress', function (done) {
			this.timeout (9000) ;
			request (app)
				.get (projectsEP + '/' + auObjIdentifier + '/progress')
				.expect ('Content-Type', /json/)
				.expect (200, done) ;
		}) ;

	}) ;

	describe ('results module', function () {
		var resultsEP ='/api/results' ;

		it('(get) ' + resultsEP + ' - get project list', function (done) {
			request (app)
				.get (resultsEP)
				.expect (200) //, done)
				.expect ('Content-Type', /json/)
				.expect (function (res) {
					res.body.should.be.Array ;
				})
				.end (function (err, res) {
					if ( err )
						throw err ;
					res.status.should.equal (200) ;
					done () ;
				}) ;
		}) ;

		// /results/:bucket/:identifier/thumbnail - Download thumbnail from a bucket/identifier pair
		// /results/:bucket/:identifier' - Get the bucket/identifier viewable data
		// /results/:bucket/:identifier/project - Get the bucket/identifier viewable data as a zip file containing all resources
		// /results/file/:bucket/:identifier/:fragment - Download a single file from its bucket/identifier/fragment pair

		// https://nicolas.perriault.net/code/2013/testing-frontend-javascript-code-using-mocha-chai-and-sinon/
		// /explore/:bucket/:identifier

	}) ;

}) ;
