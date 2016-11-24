# extract.autodesk.io test suite

The tests have been designed to run locally and via a service like [Travis CI](https://travis-ci.org/).


### Setup
When you test locally, you can use any of the setup option describe in the [main readme](../README.md), but when the test
are ran on the Travis service site, you need to use system variables to define your credential keys in your Travis project settings
(Settings -> Environment Variables)

Define a FORGE_CLIENT_ID and FORGE_CLIENT_SECRET system variables with the keys given to you on the
[Autodesk Developer portal](https://developer.autodesk.com/)

When you run locally, make sure to execute 'npm install --dev' as well. This command will download and install the
required node modules for developers automatically for you.
These modules are only required for the tests to run on your local machine.<br />
```
npm install --dev
```

### Run the test
On [Travis CI](https://travis-ci.org/), it is launched automatically.

On your local machine, run the following command: <br />
```
npm test
```
