//var mocha =require ('mocha') ;
//var expect =require ('Chai').expect ;
//var request =require ('request') ;
var request =require ('supertest') ;
var should =require ('should') ;
var app =require ('../server/server') ;
var _config =require ('../server/credentials_.js') ;
var fs =require ('fs') ;
var path =require ('path') ;
app.set ('port', process.env.PORT || 8000) ;

describe ('Starting Test server...', function () {

	var server ;
	//var port =app.get ('port') ;
	//var url ='http://extract.autodesk.io' ;
	var port =app.get ('port') ;
	//var url ='http://localhost:' + port ;

	var auObjFile ='samples/Au.obj' ;
	var auObjIdentifier ='1866-Auobj' ;
	var auObjBucket =_config.bucket ; /* transient */
	//var transientAuObjUrn ='urn:adsk.objects:os.object:' + auObjBucket + '/' + path.basename (auObjFile) ;

	/*var testFile ='Au.obj' ;
	var testIdentifier =auObjIdentifier ;
	var testBucket =_config.bucket ;
	if ( process.env.CONSUMERKEY ) {
		testBucket +='-' + process.env.CONSUMERKEY.toLowerCase () ;
	} else {
		var config =require ('../server/credentials.js') ;
		testBucket +='-' + config.credentials.client_id.toLowerCase () ;
	}
	var permanentAuObjUrn ='urn:adsk.objects:os.object:' + testBucket + '/' + testFile ;
	*/

	// Start/End test server
	before (function (done) {
		console.log ('Starting server listening on port ' + app.get ('port')) ;
		this.timeout (12000) ;
		if ( fs.existsSync ('data/token.json') )
			fs.unlinkSync ('data/token.json') ;
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
		/*it('server/credential.js present', function (done) {
			fs.exists ('server/credentials.js', function (exists) {
				exists.should.be.equal (true) ;
				done () ;
			}) ;
		}) ;

		it('server/credential.js with valid keys', function (done) {
			fs.readFile ('server/credentials.js', 'utf8', function (err, content) {
				content.indexOf ('<replace with your consumer key>').should.be.equal (-1) ;
				content.indexOf ('<replace with your consumer secret>').should.be.equal (-1) ;
				done () ;
			}) ;
		}) ;
		*/

		/*before (function (done) {
			// We need to give time to refresh the token
			this.timeout (10000) ;
			setTimeout (done, 6000) ;
		}) ;
		*/
		it('server/credential_.js present', function (done) {
			fs.exists ('server/credentials_.js', function (exists) {
				exists.should.be.equal (true) ;
				done () ;
			}) ;
		}) ;

		it('server/credential_.js with no valid keys', function (done) {
			fs.readFile ('server/credentials_.js', 'utf8', function (err, content) {
				content.indexOf ('<replace with your consumer key>').should.be.not.equal (-1) ;
				content.indexOf ('<replace with your consumer secret>').should.be.not.equal (-1) ;
				done () ;
			}) ;
		}) ;

		var access_tokenEP ='/api/token' ;
		it('(get) ' + access_tokenEP + ' - returns status 200 with a valid token', function (done) {
			request (app)
				.get (access_tokenEP)
				.expect (200) //, done)
				.expect (function (res) {
					res.text.should.be.String ;
					res.text.should.length (28) ;
				})
				.end (function (err, res) {
					if ( err )
						throw err ;
					res.status.should.equal (200) ;
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

		it('(get) ' + projectsEP + ' - get bucket list', function (done) {
			request (app)
				.get (projectsEP)
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

		it('(post) ' + projectsEP + ' - post bucket/file to oss', function (done) {
			request (app)
				.post (projectsEP)
				.send ({ 'uniqueIdentifier': auObjIdentifier, 'children': [] })
				.expect (200) //, done)
				.expect ('Content-Type', /json/)
				.expect ({ 'status': 'submitted' }, done) ;
		}) ;

		/*it('(get) ' + projectsEP + '/:bucket - get bucket details for [test file]', function (done) {
			this.timeout (9000) ;
			request (app)
				.get (projectsEP + '/' + testBucket)
				.expect ('Content-Type', /json/)
				.expect (200, done) ;
		}) ;*/

		/*it('(get) ' + projectsEP + '/:identifier - get details for [test file]', function (done) {
			this.timeout (9000) ;
			request (app)
				.get (projectsEP + '/' + testFile)
				.expect ('Content-Type', /json/)
				.expect (200, done) ;
		}) ;*/

		/*it('(get) ' + projectsEP + '/:bucket/:identifier/progress - get translation progress [test file]', function (done) {
			this.timeout (9000) ;
			request (app)
				.get (projectsEP + '/' + testBucket + '/' + testIdentifier + '/progress')
				.expect ('Content-Type', /json/)
				.expect (200)
				.end (function (err, res) {
					if ( err )
						throw err ;
					var encodedURN =new Buffer (permanentAuObjUrn).toString ('base64') ;
					res.body.should.have.property ('guid').and.be.equal (encodedURN) ;
					done () ;
				}) ;
		}) ;*/

	}) ;

	describe ('projects module (part-2)', function () {
		var projectsEP ='/api/projects' ;

		before (function (done) {
			// We need to give time to oss upload
			this.timeout (12000) ;
			setTimeout (done, 10000) ;
		}) ;

		/*it('(get) ' + projectsEP + '/:bucket - get bucket details', function (done) {
			this.timeout (9000) ;
			request (app)
				.get (projectsEP + '/' + auObjBucket)
				.expect ('Content-Type', /json/)
				.expect (200, done) ;
		}) ;*/

		it('(get) ' + projectsEP + '/:identifier - get bucket-file details', function (done) {
			this.timeout (9000) ;
			request (app)
				.get (projectsEP + '/' + auObjIdentifier)
				.expect ('Content-Type', /json/)
				.expect (200, done) ;
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
