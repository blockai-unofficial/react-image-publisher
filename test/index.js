var test = require('tapes');
var jsdom = require('jsdom');
var bitcoin = require('bitcoinjs-lib');
var randombytes = require('randombytes');
var FileReader = require("filereader");
var File = require("file-api").File;
var fs = require('fs');

/*

  React and jsdom testing harness informed by: 
    
    https://github.com/jprichardson/react-qr/blob/master/test.js
    http://stackoverflow.com/questions/30039655/react-mocha-rendering-domexception-wrong-document
    https://www.npmjs.com/package/react-test-utils

*/

var simpleCommonWallet = function(options) {

  var seed;

  if (options && options.seed) {
    seed = bitcoin.crypto.sha256(options.seed);
  }
  else {
    seed = bitcoin.crypto.sha256(randombytes(16));
  }

  var wallet = new bitcoin.Wallet(seed, bitcoin.networks.testnet);
  var address = wallet.generateAddress();

  var signMessage = function (message, cb) {
    var key = wallet.getPrivateKey(0);
    var network = bitcoin.networks.testnet;
    cb(null, bitcoin.Message.sign(key, message, network).toString('base64'));
  };

  var signRawTransaction = function(txHex, cb) {
    var tx = bitcoin.Transaction.fromHex(txHex);
    var signedTx = wallet.signWith(tx, [address]);
    var txid = signedTx.getId();
    var signedTxHex = signedTx.toHex();
    cb(false, signedTxHex, txid);
  };

  var createTransaction = function(unspentOutputs, destinationAddress, value) {
    unspentOutputs.forEach(function(utxo) {
      utxo.txHash = utxo.txid;
      utxo.index = utxo.vout;
    });
    wallet.setUnspentOutputs(unspentOutputs);
    var newTx = wallet.createTx(destinationAddress, value, 1000, address);
    var signedTx = wallet.signWith(newTx, [address]);
    var signedTxHex = signedTx.toHex();
    return signedTxHex;
  };

  var commonWallet = {
    network: 'testnet',
    signRawTransaction: signRawTransaction,
    signMessage: signMessage,
    address: address,
    createTransaction: createTransaction
  };

  return commonWallet;

};

var createRandomFile = function(size, callback) {
  // TODO: create a random image and not just text
  var buffer = randombytes(size);
  var name = "random.txt";
  var path = __dirname + "/" + name;
  var file = new File({
    name: name,
    type: "text/plain",
    buffer: buffer
  });
  fs.writeFile(path, buffer, function(err) {
    callback(file);
  });
};

test('react-image-publisher', function (t) {

  var React, ImagePublisher, TestUtils, commonWallet, commonBlockchain; 
  var file, fileBuffer, fileName, fileType;

  t.beforeEach(function (t) {
    
    for (var key in require.cache) {
      if (key.match(/\/node_modules\/react\//)) {
        delete require.cache[key];
      }
    }
    global.document = jsdom.jsdom('<!doctype html><html><body></body></html>');
    global.window = document.parentWindow;
    global.navigator = {
      userAgent: 'node.js'
    };
    React = require('react/addons');
    ImagePublisher = require('../');
    TestUtils = React.addons.TestUtils;
    commonWallet = simpleCommonWallet();
    commonBlockchain = require('blockcypher-unofficial')({
      network: "testnet"
    });
    fs.readFile(__dirname + '/test.gif', function (err, fileData) {
      // at some point we could generate a random image so we don't have conflicts in bitstore
      fileBuffer = fileData;
      fileName = "test.gif";
      fileType = "image/gif";
      file = new File({ 
        name: fileName,
        type: fileType,
        buffer: fileBuffer
      });
      t.end();
    });
  });

  t.test('should create the component', function (t) {
    var renderedComponent = TestUtils.renderIntoDocument(React.createElement(ImagePublisher, { commonWallet: commonWallet, commonBlockchain: commonBlockchain }));
    var component = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'react-image-publisher');
    var element = React.findDOMNode(component);
    t.ok(element, "has react-image-publisher DOM element");
    t.end();
  });

  test('should handle file drop', function(t) {

    t.plan(9); // from outer space

    var files = [
      file
    ];

    var fakeEvt = {
      dataTransfer: {
        files: files
      }
    };

    var onFileDrop = function(err, fileInfo) {
      var fileDropState = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'fileDropState');
      t.equal(fileDropState.getDOMNode().innerHTML, "scanned", "onFileDrop: fileDropState element should show 'scanned' after having processed the file");
      t.equal(renderedComponent.state.fileDropState, "scanned", "onFileDrop: component.state.fileDropState should be 'scanned'");
      t.equal(fileInfo.file.name, fileName, "onFileDrop: has file.name");
      t.equal(fileInfo.file.type, fileType, "onFileDrop: has file.type");
      t.equal(fileInfo.fileData, fileBuffer.toString("binary"), "onFileDrop: has fileData");
    };

    var onImagePreviewDataURL = function(err, imagePreviewDataURL) {
      var imagePreview = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'image-preview');
      t.equal(imagePreviewDataURL, imagePreview.getDOMNode().src, "onImagePreviewDataURL: image preview data URL should be image-preview src");
      t.equal(imagePreviewDataURL, "data:image/gif;base64," + fileBuffer.toString("base64"), "onImagePreviewDataURL: image preview data URL should be correct");
    };

    var renderedComponent = TestUtils.renderIntoDocument(React.createElement(ImagePublisher, { commonWallet: commonWallet, commonBlockchain: commonBlockchain, onImagePreviewDataURL: onImagePreviewDataURL, onFileDrop: onFileDrop, FileReader: FileReader }));
    var fileDropArea = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'file-drop-area');
    TestUtils.Simulate.drop(fileDropArea.getDOMNode(), fakeEvt);

    var fileDropState = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'fileDropState');
    t.equal(fileDropState.getDOMNode().innerHTML, "scanning", "fileDropState element should show 'scanning' immediately after dropping the file");
    t.equal(renderedComponent.state.fileDropState, "scanning", "component.state.fileDropState should be 'scanning'");

  });

  t.test('should allow and upload to bitstore after a file has been dropped and the upload button was clicked', function (t) {

    t.plan(8);

    var size = 256;

    createRandomFile(size, function(randomFile) {

      var fakeEvt = {
        dataTransfer: {
          files: [ randomFile ]
        }
      };

      var onFileDrop = function(err, fileInfo) {
        var uploadToBitstore = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'upload-to-bitstore');
        TestUtils.Simulate.click(uploadToBitstore.getDOMNode());
      };

      var onEndUploadToBitstore = function(err, receipt) {
        t.ok(receipt.bitstoreMeta, "onEndUploadToBitstore: has bitstoreMeta");
        var bitstoreMeta = receipt.bitstoreMeta;
        t.equal(bitstoreMeta.size, size, "onEndUploadToBitstore: bitstoreMeta has the same size");
        t.ok(bitstoreMeta.uri, "onEndUploadToBitstore: bitstoreMeta has a uri");
        t.ok(bitstoreMeta.hash_sha1, "onEndUploadToBitstore: bitstoreMeta has a hash_sha1");
      };

      var onStartUploadToBitstore = function(err, receipt) {
        var fileDropState = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'fileDropState');
        t.equal(fileDropState.getDOMNode().innerHTML, "uploading", "onStartUploadToBitstore: fileDropState element should show 'uploading' after having clicked upload");
        t.equal(renderedComponent.state.fileDropState, "uploading", "onStartUploadToBitstore: component.state.fileDropState should be 'uploading'");
        t.ok(receipt, "onStartUploadToBitstore: has receipt");
        t.ok(receipt.fileInfo.fileData, "onStartUploadToBitstore: has fileInfo.fileData");
        renderedComponent.state.fileInfo.file = __dirname + '/random.txt'; // to get around limitations of File and FileReader...
      };

      var renderedComponent = TestUtils.renderIntoDocument(React.createElement(ImagePublisher, { commonWallet: commonWallet, commonBlockchain: commonBlockchain, onStartUploadToBitstore: onStartUploadToBitstore, onEndUploadToBitstore: onEndUploadToBitstore, onFileDrop: onFileDrop, FileReader: FileReader }));

      var fileDropArea = TestUtils.findRenderedDOMComponentWithClass(renderedComponent, 'file-drop-area');
      TestUtils.Simulate.drop(fileDropArea.getDOMNode(), fakeEvt);

    });

  });

  t.end();

});