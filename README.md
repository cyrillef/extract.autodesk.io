# extract.autodesk.io sample

[![build status](https://api.travis-ci.org/cyrillef/extract.autodesk.io.png)](https://travis-ci.org/cyrillef/extract.autodesk.io)
[![Node.js](https://img.shields.io/badge/Node.js-5.11.1-blue.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-3.9.3-blue.svg)](https://www.npmjs.com/)
[![Viewer](https://img.shields.io/badge/Forge%20Viewer-v2.7-green.svg)](http://developer-autodesk.github.io/)
![Platforms](https://img.shields.io/badge/platform-windows%20%7C%20osx%20%7C%20linux-lightgray.svg)
[![License](http://img.shields.io/:license-mit-blue.svg)](http://opensource.org/licenses/MIT)


<b>Note:</b> For using this sample, you need a valid oAuth credential for the translation / extraction portion.
Visit this [page](https://developer.autodesk.com) for instructions to get on-board.


<b>Note:</b> This branch is not maintained anymore,


## Live demo from the 'service' branch at
http://extract.autodesk.io/

[![](www/images/app.png)](http://extract.autodesk.io/)


## Motivation

Our Forge Viewer adds powerful 2D and 3D viewing functionality to your web apps.
Our REST and JavaScript API makes it easier to create applications that can view, zoom and interact with 2D and
3D models from over 60+ model formats with just a web browser, no plug-in required!

But what if you wanted to view them offline? Many people ask how to proceed, while the documentation
does not explicitly says how to proceed, however the API is public and documented.
This sample will go through all the required steps.


## Description

The extract.autodesk.io server exercises and demonstrates the Autodesk Forge API authorization,
translation, viewing processes mentioned in the Quick Start guide. It also demonstrates how to extract the 'bubbles' files
from the Autodesk server for storing and viewing them locally.


It closely follows the steps described in the documentation:

* http://developer.api.autodesk.com/documentation/v1/vs_quick_start.html

In order to make use of this sample, you need to register your consumer and secret keys:

* https://developer.autodesk.com > My Apps

This provides the credentials to supply to the http requests on the Autodesk server.


## Dependencies

This sample is dependent on the server part on Node.js and couple of Node.js extensions
which would update/install automatically via 'npm':

1. Node.js

    Node.js - built on Chrome's JavaScript runtime for easily building fast, scalable network applications.
	You need at least version v5.11.1. You can get Node.js from [here](http://nodejs.org/)<br /><br />
	Node.js modules:
	```
    "adm-zip": ">= 0.4.7",
    "archiver": ">= 0.14.3",
    "async": ">= 1.2.0",
    "body-parser": ">= 1.11.0",
    "connect-multiparty": ">= 1.2.5",
    "cron": ">= 1.0.6",
    "ejs": ">= 2.2.4",
    "express": ">= 4.12.3",
    "fs": ">= 0.0.2",
    "gen-uid": "0.0.2",
    "mkdirp": ">= 0.5.0",
    "moment": ">= 2.10.3",
    "path": ">= 0.11.14",
    "request": ">= 2.55.0",
    "rimraf": " >= 2.2.8",
    "serve-favicon": ">= 2.3.0",
    "stream": ">= 0.0.2",
    "unirest": ">= 0.4.0",
    "url": ">= 0.10.2",
    "util": ">= 0.10.3",
    "bower": "^1.6.5",
    "mailjet-sendemail": "^1.1.4"
	```

This sample is also dependent on the client side on couple of javascript library
which would update/install automatically via 'bower':

1. [flow.js](https://github.com/flowjs/flow.js) - A JavaScript library providing multiple simultaneous, stable,
   fault-tolerant and resumable/restartable file uploads via the HTML5 File API.

2. [Bootstrap](http://getbootstrap.com/) - Bootstrap is the most popular HTML, CSS, and JS framework for developing
   responsive, mobile first projects on the web.

3. [jsPlumb](https://jsplumbtoolkit.com/community/doc/home.html) - jsPlumb Community edition provides a means for a
   developer to visually connect elements on their web pages, using SVG.

4. [dagre](https://github.com/cpettitt/dagre) - Dagre is a JavaScript library that makes it easy to lay out directed
   graphs on the client-side.

All these libraries can be install via bower
```
"jquery": "^ 2.1.4",
"view-and-data-toolkit": "*",
"flow.js": "^ 2.9.0",
"bootstrap": "^ 3.3.6",
"jquery.cookie": "^ 1.4.1",
"jsPlumb": "= 2.1.2",
"dagre": "~0.7.4",
"jquery-ui": "~1.11.4"
```


## Setup/Usage Instructions

The sample was created using Node.js and javascript.

Live version at: http://extract.autodesk.io/


### Setup
There is 2 ways to configure the sample with your application keys, please choose one of the option at step 4. Developers,
make sure to read [the developer notes](test/readme.md) before anything.<br />

1. Download and install [Node.js](http://nodejs.org/) (that will install npm as well)
2. Download this repo anywhere you want (the server will need to write files, so make sure you install in
   a location where you have write permission, at least the 'tmp', 'data' and '/www/extracted' folders)
3. Execute 'npm install', this command will download and install the required node & bower modules automatically for you.<br />
   ```
   npm install
   ```
4. Install your credential keys to run the sample: <br />
   a. Option 1: enter your keys in a permanent file which will never be saved in your GitHub repo. This is
      because you do not want to expose your keys to anyone, and this is the reason why this file is never
      saved in the repo. You can decide to save this file in a private GitHub repo by editing the .gitignore file.

      * From the sample root folder, rename or copy the ./server/credentials_.js file into ./server/credentials.js<br />
         * Windows<br />
           ```
            copy server/credentials_.js server/credentials.js
            ```
         * OSX/Linux<br />
            ```
            cp server/credentials_.js server/credentials.js
            ```

      * Edit credentials.js and replace keys placeholder (client_id and client_secret) with your keys. I.e.:<br />
      &lt;replace with your consumer key&gt; <br />
      &lt;replace with your consumer secret&gt; <br />

   b. Option 2: use system environment variables. This is actually the option you need to use for the tests suite
      which runs on Travis-CI.
      * Define a CONSUMERKEY and CONSUMERSECRET system variables from the console or script which will launch the
         server.<br />
          * Windows<br />
            ```
            set CONSUMERKEY=xxx

            set CONSUMERSECRET=xxx
            ```
          * OSX/Linux<br />
            ```
            export CONSUMERKEY xxx

            export CONSUMERSECRET xxx
            ```
            or passing on the command line to the Node.js process<br />
            ```
            sudo [PORT=<port>] CONSUMERKEY=xxx CONSUMERSECRET=xxx node start.js
            ```
            <br />
            Replace keys placeholder xxx with your own keys.

5. You are done for the setup, launch the node server using the command '[sudo] node start.js'.
   sudo is required only on OSX and Linux.<br />
   * Windows<br />
   ```
   [set PORT=<port>]
   node start.js
   ```
   * OSX/Linux<br />
   ```
   sudo [PORT=<port>] node start.js
   ```
   <br />
   <b>Note:</b> the port argument can be omitted and default to port 80. If port 80 is already in use by another
   application (like Skype, or IIS, or Apache, ...), you can use any other free port such as 8000, 3000, etc...
   But in the next section you would need to specify the port to use, i.e. http://localhost[:port]/

6. If you choose option b. for setup, launch http://localhost[:port]/setup.html, otherwise you are good to go with
   http://localhost[:port]/


<a name="UseOfTheSample"></a>
### Use of the sample

Translating files / Extracting 'bubbles'

1. Start your favorite browser supporting HTML5 and WEBGL and browse to [http://localhost/](http://localhost/).<br />
   <b>Note:</b> In case you use a different port above do not forget to include it in the URL. I.e.
   [http://localhost:3000/](http://localhost:3000/).
2. Drag'n Drop your files into the 'Drop area' or browse for individual files or grab files for your dropbox, box or
   google drive account.
   Tips: start with the main file in your file has dependencies, that will build the connections automatically.
3. Once all files are uploaded on your local server, press the 'Create project' button to translate your file(s).
4. If you uploaded more that one file, the system will give you a chance to review and edit connections. If a connection
   is not correct, delete the connection by clicking on the connection line, and build a new connection
   starting from the parent 'yellow' square to the child dependency.
5. After the translation completed successfully, move your mouse over the project thumbnail at the bottom of the page
   ('View submitted Projects' tab) and press the 'Explore' button.
6. On the new page, you should review your model and if you're happy with what you see, you can request to download the
   'bubbles' from the server. Sometimes the process can take a long time, so you can register to be notified by email
   when the process completed and get a direct link on the resulting zip file.


<a name="node"></a>
Viewing 'bubbles' offline using Node.js

1. This step needs to be done only once per machine. Setup Node.js http-server server.<br />
   ```
   npm install http-server -g
   ```
2. Unzip the project result zip file into a folder.
3. Execute the index.bat file provide in the zip file, or
   a. Start your local node http-server server.<br />
      ```
      [sudo] http-server <myfolder>
      ```
   b. Start your favorite browser supporting HTML5 and WEBGL and browse to [http://localhost:8080/](http://localhost:8080/)
      and select any of the html *.svf.* files.<br />
      (or execute any .bat file located in your folder - usually '0.svf.html.bat' or shell script if you are on OSX or Linux - usually '0.svf.html.sh')


<a name="others"></a>
Viewing 'bubbles' offline using PHP 5.4.x+

1. This step needs to be done only once per machine. Download and install PHP 5.4+ on your computer.
2. Unzip the project result zip file into a folder.
3. Start your local PHP http server.<br />
   ```
   cd <myfolder>

   php -S localhost:8000
   ```
4. Start your favorite browser supporting HTML5 and WEBGL and browse to
   [http://localhost:8000/](http://localhost:8000/) and select any of the html *.svf.* files.


Viewing 'bubbles' offline using Python

1. This step needs to be done only once per machine. Download and install Python on your computer.
2. Unzip the project result zip file into a folder.
3. Start your local Python http server.<br />
   ```
   cd <myfolder>

   # with Python 2.x

   python -m SimpleHTTPServer

   # with Python 3.x+

   python -m http-server
   ```
5. Start your favorite browser supporting HTML5 and WEBGL and browse to
   [http://localhost:8000/](http://localhost:8000/) and select any of the html *.svf.* files.


Viewing 'bubbles' offline using Ruby

1. This step needs to be done only once per machine. Download and install Ruby on your computer.
2. Unzip the project result zip file into a folder.
3. Start your local Ruby http server.<br />
   ```
   cd <myfolder>

   ruby -r webrick -e "s = WEBrick::HTTPServer.new(:Port => 8000, :DocumentRoot => Dir.pwd); trap('INT') { s.shutdown }; s.start"
   ```
4. Start your favorite browser supporting HTML5 and WEBGL and browse to
   [http://localhost:8000/](http://localhost:8000/) and select any of the html *.svf.* files.


## Package an offline viewing solutions

### Package with Python

On Windows only: simply copy the Python directory on your CD, and launch the server via a script when your application wants to show a LMV result. Make sure to set the PATH to point to your CD Python location to avoid errors.
On OSX, Linux: Python is already installed, so you can use the default Python on these OS.

Usage:
```
cd <my sample directory>
python -m SimpleHTTPServer [port]
```


### Package with Node/http-server

on all platform you may install the http-server utility. http-server is a simple, zero-configuration command-line http server. It is powerful enough for production usage, but it's simple and hackable enough to be used for testing, local development, and learning.

To  install http-server, go on your node.js console and enter the following command:
```
npm install http-server -g
```

Usage:
```
cd <my sample directory>
http-server [path] [options]
```

[path] defaults to ./public if the folder exists, and ./ otherwise.


--------

## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT).
Please see the [LICENSE](LICENSE) file for full details.


## Written by

Cyrille Fauvel (Autodesk Developer Network)<br />
http://www.autodesk.com/adn<br />
http://around-the-corner.typepad.com/
