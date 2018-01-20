# extract.autodesk.io sample

[![build status](https://api.travis-ci.org/cyrillef/extract.autodesk.io.png)](https://travis-ci.org/cyrillef/extract.autodesk.io)
[![Node.js](https://img.shields.io/badge/Node.js-6.3.1-blue.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-3.10.3-blue.svg)](https://www.npmjs.com/)
![Platforms](https://img.shields.io/badge/platform-windows%20%7C%20osx%20%7C%20linux-lightgray.svg)
[![License](http://img.shields.io/:license-mit-blue.svg)](http://opensource.org/licenses/MIT)


*Forge API*:
[![oAuth2](https://img.shields.io/badge/oAuth2-v1-green.svg)](http://developer-autodesk.github.io/)
[![Data-Management](https://img.shields.io/badge/Data%20Management-v1-green.svg)](http://developer-autodesk.github.io/)
[![OSS](https://img.shields.io/badge/OSS-v2-green.svg)](http://developer-autodesk.github.io/)
[![Model-Derivative](https://img.shields.io/badge/Model%20Derivative-v2-green.svg)](http://developer-autodesk.github.io/)
[![Viewer](https://img.shields.io/badge/Forge%20Viewer-v3.3-green.svg)](http://developer-autodesk.github.io/)

<b>Important: What is demonstrated here, is not officially supported by Autodesk, and may break in future. This is why this sample is posted on my private github repo. You should be using this 'offline' approach only when you are developing an applicationile in development, for backup reasons, or when your application does not have access to the internet.</b>

<b>Note:</b> For using this sample, you need a valid oAuth credential for the translation / extraction portion.
Visit this [page](https://developer.autodesk.com) for instructions to get on-board.


## Live demo from the 'service' branch at
http://extract.autodesk.io/

[![](www/images/app.png)](http://extract.autodesk.io/)


## Description

The extract.autodesk.io server exercises and demonstrates the Autodesk Forge API authorization,
translation, viewing processes mentioned in the Quick Start guide.
It also demonstrates how to extract the 'bubbles' files from the Autodesk server for storing and viewing them locally.

In order to make use of this sample, you need to register your consumer and secret keys:

* https://developer.autodesk.com > My Apps

This provides the credentials to supply to the http requests to the Autodesk server endpoints.


## Dependencies

This sample is dependent on the server part on Node.js and couple of Node.js extensions
which would update/install automatically via 'npm':

This sample is dependent of Node.js and few Node.js extensions which would update/install automatically via 'npm'.

1. Node.js - built on Chrome's JavaScript runtime for easily building fast, scalable network applications.
   You can get Node.js from [here](http://nodejs.org/)

This sample is also dependent on the client side on couple of javascript library
which would update/install automatically via 'bower':

2. [flow.js](https://github.com/flowjs/flow.js) - A JavaScript library providing multiple simultaneous, stable,
   fault-tolerant and resumable/restartable file uploads via the HTML5 File API.

3. [Bootstrap](http://getbootstrap.com/) - Bootstrap is the most popular HTML, CSS, and JS framework for developing
   responsive, mobile first projects on the web.

4. [jQuery](https://jquery.com/).


## Setup/Usage Instructions

### Deploy on Heroku

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)


<a name="setupSample"></a>
### Setup
1. Download and install [Node.js](http://nodejs.org/) (that will install npm as well)
2. Download this repo anywhere you want (the server will need to write files, so make sure you install in
   a location where you have write permission, at least the 'tmp', 'data' and '/www/extracted' folders)
3. Execute 'npm install', this command will download and install the required node modules automatically for you. <br />
   ```
   npm install
   ```
4. Install your credential keys: <br />
   Use system environment variables (This is actually the option you need to use for the tests suite
   which runs on [Travis-CI](https://travis-ci.org/)). Replace keys placeholder xxx with your own keys.

          * Windows<br />
            ```
            set FORGE_CLIENT_ID=xxx

            set FORGE_CLIENT_SECRET=xxx

            [set PORT=<port>]

			node start.js
            ```
          * OSX/Linux<br />
            ```
            [sudo] [PORT=<port>] FORGE_CLIENT_ID=xxx FORGE_CLIENT_SECRET=xxx node start.js
            ```
   <br />
   <b>Note:</b> the port argument can be omitted and default to port 80. If port 80 is already in use by another
   application (like Skype, or IIS, or Apache, ...), you can use any other free port such as 8000, 3000, etc...
   But in the next section you would need to specify the port to use, i.e. http://localhost[:port]/


<a name="UseOfTheSample"></a>
### Use of the sample

Translating files / Extracting 'bubbles'

1. Start your favorite browser supporting HTML5 and WEBGL and browse to http://localhost/.<br />
   <b>Note:</b> In case you use a different port above do not forget to include it in the URL. I.e.
   http://localhost:3000/.
2. Drag'n Drop your files into the 'Drop area' or browse for individual files or grab files for your dropbox, box or
   google drive account.
   Tips: start with the main file in your file has dependencies.
3. Select the master file. The master is the file that Forge will load to trigger translation.
4. Once all files are uploaded on your local server, press the 'Submit my project' button to translate your file(s).
5. After the translation completed successfully, move your mouse over the project thumbnail at the bottom of the page
   ('View submitted Projects' tab) and press the 'Explore' button.
6. On the new page, you should review your model and if you're happy with what you see, you can request to download the
   'bubbles' from the server. Sometimes the process can take a long time, so you can register to be notified by email
   when the process completed and get a direct link on the resulting zip file.


<a name="node"></a>
### Viewing 'bubbles' offline using Node.js

1. This step needs to be done only once per machine. Setup Node.js http-server server.<br />
   ```
   npm install http-server -g
   ```
2. Unzip the project zip file into a folder.
3. Execute the index.bat or ./index depending of your OS, or follow instructions below
   a. Start your local node http-server server.<br />
      ```
      [sudo] http-server <myfolder>
      ```
   b. Start your favorite browser supporting HTML5 and WEBGL and browse to [http://localhost:8080/](http://localhost:8080/)


<a name="others"></a>
### Viewing 'bubbles' offline using PHP 5.4.x+

1. This step needs to be done only once per machine. Download and install PHP 5.4+ on your computer.
2. Unzip the project zip file into a folder.
3. Start your local PHP http server.<br />
   ```
   cd <myfolder>

   php -S localhost:8000
   ```
4. Start your favorite browser supporting HTML5 and WEBGL and browse to
   [http://localhost:8000/](http://localhost:8000/)


### Viewing 'bubbles' offline using Python

1. This step needs to be done only once per machine. Download and install Python on your computer.
2. Unzip the project zip file into a folder.
3. Start your local Python http server.<br />
   ```
   cd <myfolder>

   # with Python 2.x

   python -m SimpleHTTPServer

   # with Python 3.x+

   python -m http-server
   ```
5. Start your favorite browser supporting HTML5 and WEBGL and browse to
   [http://localhost:8000/](http://localhost:8000/)


### Viewing 'bubbles' offline using Ruby

1. This step needs to be done only once per machine. Download and install Ruby on your computer.
2. Unzip the project zip file into a folder.
3. Start your local Ruby http server.<br />
   ```
   cd <myfolder>

   ruby -r webrick -e "s = WEBrick::HTTPServer.new(:Port => 8000, :DocumentRoot => Dir.pwd); trap('INT') { s.shutdown }; s.start"
   ```
4. Start your favorite browser supporting HTML5 and WEBGL and browse to
   [http://localhost:8000/](http://localhost:8000/)


## Package an offline viewing solutions

### Package with Python

On Windows only: simply copy the Python directory on your CD, and launch the server via a script when your application
wants to show a LMV result. Make sure to set the PATH to point to your CD Python location to avoid errors.
On OSX, Linux: Python is already installed, so you can use the default Python on these OS.

Usage:
```
cd <my sample directory>
python -m SimpleHTTPServer [port]
```


### Package with Node/http-server

On all platform you may install the http-server utility. http-server is a simple, zero-configuration command-line
http server. It is powerful enough for production usage, but it's simple and hackable enough to be used for testing,
local development, and learning.

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

While the sample is licensed under the terms of the MIT license, the content people post on this site and the bubbles you
can extract remain the property of their owner. For a good customer experience the resulting ZIP file includes
the current version of the viewer, but the intellectual property of this component remains Autodesk's.
You can freely use it for offline viewing on your device, and/or use it on you website, but you cannot claim
it to be yours.

## Written by

Cyrille Fauvel <br />
Forge Partner Development <br />
http://developer.autodesk.com/ <br />
http://around-the-corner.typepad.com <br />
