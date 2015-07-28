var test = require('tapes');
var jsdom = require('jsdom');
var FileReader = require("filereader");

var request = require('request');
var blockcast = require('blockcast');

var testCommonWallet = require('test-common-wallet');

var createRandomDropFileEvent = require('./create-random-drop-file-event');
var createDropTestImageEvent = require('./create-drop-test-image-event');

/*

  React and jsdom testing harness informed by: 
    
    https://github.com/jprichardson/react-qr/blob/master/test.js
    http://stackoverflow.com/questions/30039655/react-mocha-rendering-domexception-wrong-document
    https://www.npmjs.com/package/react-test-utils
    https://github.com/silvenon/react-demo/issues/1#issuecomment-122568860

  Keep an eye on: 

    https://discuss.reactjs.org/t/whats-the-prefered-way-to-test-react-js-components/26
    http://facebook.github.io/react/docs/test-utils.html#shallow-rendering
    https://github.com/robertknight/react-testing/blob/master/tests/TweetList_test.js#L98

*/

global.document = jsdom.jsdom('<!doctype html><html><body></body></html>');
global.window = document.parentWindow;
global.navigator = {
  userAgent: 'node.js'
};
global.FileReader = FileReader;
global.window.FileReader = FileReader;

var React = require('react/addons');
var ImagePublisher = require('../');
var TestUtils = React.addons.TestUtils;

var commonBlockchain = require('blockcypher-unofficial')({
  network: "testnet"
});

var commonWallet = testCommonWallet({
  seed: "test",
  network: "testnet",
  commonBlockchain: commonBlockchain
});
test('react-image-publisher', function (t) {

  t.test('should create the component', function (t) {
    var renderedComponent = TestUtils.renderIntoDocument(React.createElement(ImagePublisher, { commonWallet: commonWallet, commonBlockchain: commonBlockchain }));
    var component = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'react-image-publisher');
    var element = React.findDOMNode(component);
    t.ok(element, "has react-image-publisher DOM element");
    t.end();
  });

  t.test('should handle file drop', function(t) {

    t.plan(7); // from outer space

    createDropTestImageEvent(function(fakeEvt, file) {

      var onFileDrop = function(err, fileInfo) {
        var fileDropState = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'file-drop-state');
        t.equal(renderedComponent.state.fileDropState, "scanned", "onFileDrop: component.state.fileDropState should be 'scanned'");
        t.equal(fileInfo.file.name, file.name, "onFileDrop: has file.name");
        t.equal(fileInfo.file.type, file.type, "onFileDrop: has file.type");
        t.equal(fileInfo.fileData, file.buffer.toString("binary"), "onFileDrop: has fileData");
      };

      var onImagePreviewDataURL = function(err, imagePreviewDataURL) {
        var imagePreview = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'image-preview');
        t.equal(imagePreviewDataURL, imagePreview.getDOMNode().src, "onImagePreviewDataURL: image preview data URL should be image-preview src");
        t.equal(imagePreviewDataURL, "data:image/gif;base64," + file.buffer.toString("base64"), "onImagePreviewDataURL: image preview data URL should be correct");
      };

      var renderedComponent = TestUtils.renderIntoDocument(React.createElement(ImagePublisher, { 
        commonWallet: commonWallet, 
        commonBlockchain: commonBlockchain, 
        onImagePreviewDataURL: onImagePreviewDataURL, 
        onFileDrop: onFileDrop 
      }));
      var fileDropArea = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'file-drop-area');
      TestUtils.Simulate.drop(fileDropArea.getDOMNode(), fakeEvt);

      var fileDropState = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'file-drop-state');
      t.equal(renderedComponent.state.fileDropState, "scanning", "component.state.fileDropState should be 'scanning'");

    });  

  });

  t.test('should upload to bitstore and register with openpublish', function (t) {

    t.plan(15);

    var size = 256;

    createRandomDropFileEvent(size, function(fakeEvt, randomFile) {

      var onFileDrop = function(err, fileInfo) {
        var uploadToBitstore = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'upload-to-bitstore');
        var uploadToBitstoreButton = uploadToBitstore.getDOMNode();
        TestUtils.Simulate.click(uploadToBitstoreButton);
      };

      var onStartRegisterWithOpenPublish = function(err, fileInfo) {
        renderedComponent.forceUpdate(function() {
          t.equal(renderedComponent.state.fileDropState, "propagating", "onStartRegisterWithOpenPublish: component.state.fileDropState should be 'propagating'");
        });
      };

      var onEndRegisterWithOpenPublish = function(err, openPublishReceipt) {
        t.ok(openPublishReceipt.data.op == "r", "onEndRegisterWithOpenPublish:openPublishReceipt.data should be a registration op");
        t.equal(renderedComponent.state.fileDropState, "propagated", "onEndRegisterWithOpenPublish: component.state.fileDropState should be 'propagated'");
        var blockcastTx = openPublishReceipt.blockcastTx;
        var txid = blockcastTx.txid;
        t.ok(txid, "onEndRegisterWithOpenPublish: openPublishReceipt.blockcastTx should have a txid");
        var uri = openPublishReceipt.data.uri;
        t.ok(uri, "onEndRegisterWithOpenPublish: openPublishReceipt.data should have a uri");
        request(uri, function(err, res, body) {
          t.equal(body, randomFile.buffer.toString("utf8"), "onEndRegisterWithOpenPublish:request: uri should return the same data as randomFile");
        });
      }

      var onEndUploadToBitstore = function(err, receipt) {
        t.ok(receipt.bitstoreMeta, "onEndUploadToBitstore: has bitstoreMeta");
        var bitstoreMeta = receipt.bitstoreMeta;
        t.equal(bitstoreMeta.size, size, "onEndUploadToBitstore: bitstoreMeta has the same size");
        t.ok(bitstoreMeta.uri, "onEndUploadToBitstore: bitstoreMeta has a uri");
        t.ok(bitstoreMeta.hash_sha1, "onEndUploadToBitstore: bitstoreMeta has a hash_sha1");
        delete(randomFile.stream); // if we want to re-use a file, we need to do a hack to remove the stream...
        renderedComponent.state.fileInfo.file = randomFile // undo our hack...
        var registerWithOpenPublish = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'register-with-openpublish');
        TestUtils.Simulate.click(registerWithOpenPublish.getDOMNode());
      };

      var onStartUploadToBitstore = function(err, receipt) { 
        var fileDropState = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'file-drop-state');
        t.equal(renderedComponent.state.fileDropState, "uploading", "onStartUploadToBitstore: component.state.fileDropState should be 'uploading'");
        t.ok(receipt, "onStartUploadToBitstore: has receipt");
        t.ok(receipt.fileInfo.fileData, "onStartUploadToBitstore: has fileInfo.fileData");
        t.ok(receipt.bitstoreBalance > 0, "onStartUploadToBitstore: has bitstoreBalance greater than 0");
        t.ok(receipt.bitstoreDepositAddress, "onStartUploadToBitstore: has bitstoreDepositAddress");
        /*

          We need to use a small hack to get around limitations of File and FileReader...

          For this test suite, when we call bitstoreClient.files.put(fileInfo.file, callbackFunction),
          we want bitstoreClient to see a string and assume it is the path to a file as opposed to working
          off of an instance of the browser File object...

          A more elegeant solution would be to fix the File object in the 'file-api' module so it is compatible with
          superagent inside of the bitstoreClient.

        */ 
        renderedComponent.state.fileInfo.file = __dirname + '/random.txt'; // hack to get around limitations of File and FileReader
      };

      var renderedComponent = TestUtils.renderIntoDocument(React.createElement(ImagePublisher, { 
        commonWallet: commonWallet, 
        commonBlockchain: commonBlockchain, 
        onStartUploadToBitstore: onStartUploadToBitstore, 
        onEndUploadToBitstore: onEndUploadToBitstore,
        onStartRegisterWithOpenPublish: onStartRegisterWithOpenPublish, 
        onEndRegisterWithOpenPublish: onEndRegisterWithOpenPublish, 
        onFileDrop: onFileDrop 
      }));

      var fileDropArea = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'file-drop-area');
      TestUtils.Simulate.drop(fileDropArea.getDOMNode(), fakeEvt);

    });

  });

  t.end();

});
