'use strict';

var React = require('react');
var openpublish = require('openpublish');
var bitstore = require('bitstore');
var shasum = require('shasum');

var ImagePublisher = React.createClass({
  displayName: 'ImagePublisher',
  propTypes: {
    commonBlockchain: React.PropTypes.object.isRequired,
    commonWallet: React.PropTypes.object.isRequired,
    onStartTopUpBalance: React.PropTypes.func,
    onEndTopUpBalance: React.PropTypes.func,
    onStartUploadToBitstore: React.PropTypes.func,
    onEndUploadToBitstore: React.PropTypes.func,
    onStartRegisterWithOpenPublish: React.PropTypes.func,
    onEndRegisterWithOpenPublish: React.PropTypes.func
  },
  getInitialState: function getInitialState() {
    return {
      signedPayload: false,
      fileInfo: false,
      bitstoreMeta: false,
      bitstoreDepositAddress: false,
      bitstoreBalance: false,
      fileDropState: false,
      fileSha1: false,
      payloadsLength: 0,
      propagationStatus: ''
    };
  },
  componentWillMount: function componentWillMount() {
    var commonWallet = this.props.commonWallet;
    var bitstoreClient = this.props.bitstoreClient || bitstore(commonWallet);
    this.setState({
      bitstoreClient: bitstoreClient
    });
  },
  componentDidMount: function componentDidMount() {},
  updateBitstoreBalance: function updateBitstoreBalance(callback) {
    var component = this;
    var bitstoreClient = this.state.bitstoreClient;
    bitstoreClient.wallet.get(function (err, res) {
      var bitstoreBalance = res.body.balance;
      var bitstoreDepositAddress = res.body.deposit_address;
      component.setState({
        bitstoreDepositAddress: bitstoreDepositAddress,
        bitstoreBalance: bitstoreBalance
      });
      console.log('bitstore wallet info', res.body);
      if (callback) {
        callback(false, bitstoreBalance);
      }
    });
  },
  topUpBalance: function topUpBalance() {
    var component = this;
    var commonWallet = this.props.commonWallet;
    var value; // wire up to UI
    var destinationAddress = this.state.bitstoreDepositAddress;
    commonWallet.createTransaction({
      destinationAddress: destinationAddress,
      valueInBTC: value
    }, function (err, signedTxHex) {
      commonBlockchain.Transactions.Propagate(signedTxHex, function (err, receipt) {
        if (err) {
          return;
        }
        component.setState({
          bitstoreState: 'waiting for confirmation'
        });
        var checkBitstoreBalance = function checkBitstoreBalance(options) {
          var retryAttempts = options.retryAttempts;
          component.updateBitstoreBalance(function (err, bitstoreBalance) {
            if (bitstoreBalance <= 0) {
              component.setState({
                bitstoreState: 'still waiting for confirmation'
              });
              return setTimeout(function () {
                if (retryAttempts > 0) {
                  return checkBitstoreBalance(retryAttempts--);
                }
                component.setState({
                  bitstoreState: 'done waiting for confirmation'
                });
              }, 2000);
            }
            component.setState({
              bitstoreState: 'confirmed',
              fileDropState: 'scanned'
            });
          });
        };

        checkBitstoreBalance({
          retryAttempts: 5
        });
      });
    });
  },
  registerWithOpenPublish: function registerWithOpenPublish() {
    var component = this;
    var onStartRegisterWithOpenPublish = this.props.onStartRegisterWithOpenPublish;
    var onEndRegisterWithOpenPublish = this.props.onEndRegisterWithOpenPublish;
    var fileSha1 = this.state.fileSha1;
    var bitstoreMeta = this.state.bitstoreMeta;
    var fileDropState = this.state.fileDropState;
    var fileInfo = this.state.fileInfo;
    var title = React.findDOMNode(this.refs.title).value;
    var keywords = React.findDOMNode(this.refs.keywords).value;
    console.log('title', title);
    var commonWallet = this.props.commonWallet;
    var commonBlockchain = this.props.commonBlockchain;
    if (!bitstoreMeta || !bitstoreMeta.uri || fileDropState != 'uploaded' || !fileInfo || !fileInfo.file || !fileSha1) {
      return;
    }
    this.setState({
      fileDropState: 'registering'
    });
    if (onStartRegisterWithOpenPublish) {
      onStartRegisterWithOpenPublish(false, fileInfo);
    }
    openpublish.register({
      uri: bitstoreMeta.uri,
      sha1: fileSha1,
      file: fileInfo.file,
      // title: title, // get from UI
      // keywords: keywords, // get from UI
      commonWallet: commonWallet,
      commonBlockchain: commonBlockchain
    }, function (err, openPublishReceipt) {
      component.setState({
        fileDropState: 'registered'
      });
      if (onEndRegisterWithOpenPublish) {
        onEndRegisterWithOpenPublish(false, openPublishReceipt);
      }
    });
  },
  uploadToBitstore: function uploadToBitstore() {
    var component = this;
    var onStartUploadToBitstore = this.props.onStartUploadToBitstore;
    var onEndUploadToBitstore = this.props.onEndUploadToBitstore;
    var commonWallet = this.props.commonWallet;
    var bitstoreClient = this.state.bitstoreClient;
    var fileInfo = this.state.fileInfo;
    var fileDropState = this.state.fileDropState;
    var fileSha1 = this.state.fileSha1;
    if (fileDropState != 'scanned' || !fileInfo || !fileInfo.file || !fileSha1) {
      return;
    }
    bitstoreClient.files.meta(fileSha1, function (err, res) {
      var bitstoreMeta = res.body;
      if (bitstoreMeta.size) {
        // needs a more robust check
        component.setState({
          bitstoreStatus: 'existing',
          bitstoreMeta: bitstoreMeta,
          fileDropState: 'uploaded'
        });
        return;
      }
      bitstoreClient.wallet.get(function (err, res) {
        var bitstoreBalance = res.body.balance;
        var bitstoreDepositAddress = res.body.deposit_address;
        component.setState({
          bitstoreDepositAddress: bitstoreDepositAddress,
          bitstoreBalance: bitstoreBalance
        });
        if (bitstoreBalance <= 0) {
          component.setState({
            bitstoreState: 'no balance'
          });
          return;
        }
        component.setState({
          bitstoreClient: bitstoreClient,
          fileDropState: 'uploading'
        });
        if (onStartUploadToBitstore) {
          onStartUploadToBitstore(false, {
            bitstoreBalance: bitstoreBalance,
            bitstoreDepositAddress: bitstoreDepositAddress,
            fileInfo: fileInfo
          });
        }
        bitstoreClient.files.put(fileInfo.file, function (error, res) {
          var bitstoreMeta = res.body;
          component.setState({
            bitstoreStatus: 'new',
            bitstoreMeta: bitstoreMeta,
            fileDropState: 'uploaded'
          });
          if (onEndUploadToBitstore) {
            onEndUploadToBitstore(false, {
              bitstoreMeta: bitstoreMeta
            });
          }
        });
      });
    });
  },
  dragOver: function dragOver(event) {
    event.stopPropagation();
    event.preventDefault();
  },
  dragEnd: function dragEnd(event) {
    event.stopPropagation();
    event.preventDefault();
  },
  drop: function drop(event) {
    event.preventDefault();
    var component = this;
    var file = event.dataTransfer.files[0];
    component.setState({
      fileDropState: 'scanning'
    });

    var bufferReader = new FileReader();
    bufferReader.addEventListener('load', function (e) {
      var arr = new Uint8Array(e.target.result);
      var buffer = new Buffer(arr);
      var sha1 = shasum(buffer);
      component.setState({
        fileSha1: sha1
      });
    });
    bufferReader.readAsArrayBuffer(file);

    var reader = new FileReader();
    reader.onload = function (event) {
      var fileData = event.target.result;
      var fileInfo = {
        file: file,
        fileData: fileData
      };
      component.setState({
        fileDropState: 'scanned',
        fileInfo: fileInfo
      });
      if (component.props.onFileDrop) {
        component.props.onFileDrop(false, fileInfo);
      }
    };
    reader.readAsBinaryString(file);

    var preview = new FileReader();
    preview.onload = function (event) {
      var imagePreviewDataURL = event.target.result;
      component.setState({
        imgPreviewDataURL: imagePreviewDataURL
      });
      if (component.props.onImagePreviewDataURL) {
        component.props.onImagePreviewDataURL(false, imagePreviewDataURL);
      }
    };
    preview.readAsDataURL(file);
  },
  render: function render() {
    var fileDropState = this.state.fileDropState;
    var imgPreview = this.state.imgPreviewDataURL ? React.createElement('img', { className: 'image-preview', src: this.state.imgPreviewDataURL }) : false;
    var bitstoreMeta = this.state.bitstoreMeta;
    var bitstoreState = this.state.bitstoreState;
    var commonWallet = this.props.commonWallet;
    var displayUri = bitstoreMeta.uri ? bitstoreMeta.uri.split('//')[1].split('/')[0] : '';
    var fileName = this.state.fileInfo ? this.state.fileInfo.file.name : '';
    var fileType = this.state.fileInfo ? this.state.fileInfo.file.type : '';
    var fileSize = this.state.fileInfo ? this.state.fileInfo.file.size : '';
    return React.createElement(
      'div',
      { className: 'react-image-publisher' },
      React.createElement(
        'div',
        { className: 'container' },
        React.createElement(
          'div',
          { className: 'certificate' },
          React.createElement(
            'div',
            { className: 'file-drop-area ' + (fileDropState ? 'file-exists' : ''), onDragOver: this.dragOver, onDragEnd: this.dragEnd, onDrop: this.drop },
            React.createElement(
              'div',
              { className: 'file-drop-state' },
              fileDropState ? '' : 'Drop file here to begin'
            ),
            imgPreview
          ),
          React.createElement(
            'div',
            { className: 'openpublish-container' },
            React.createElement(
              'p',
              { className: 'proclaimation' },
              'This Certifies that ',
              React.createElement(
                'span',
                { className: 'address' },
                commonWallet.address
              ),
              ' is the'
            ),
            React.createElement(
              'p',
              { className: 'share-definition' },
              'registered holder of ',
              React.createElement(
                'span',
                { className: 'share-count' },
                '100,000,000'
              ),
              ' shares'
            ),
            React.createElement(
              'p',
              { className: 'media-definition' },
              'that represent a limited and nonexclusive ownership of copyright for work identified by the SHA-1 value of ',
              React.createElement(
                'span',
                { className: 'sha-1' },
                this.state.fileSha1
              )
            ),
            React.createElement(
              'div',
              { className: 'data-definition' },
              React.createElement(
                'div',
                { className: 'file-data' },
                React.createElement(
                  'div',
                  { className: 'data-item file-name' },
                  React.createElement(
                    'label',
                    { 'for': 'name' },
                    'Name'
                  ),
                  ' ',
                  React.createElement(
                    'span',
                    { className: 'name' },
                    fileName
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'data-item file-type' },
                  React.createElement(
                    'label',
                    { 'for': 'type' },
                    'Type'
                  ),
                  ' ',
                  React.createElement(
                    'span',
                    { className: 'type' },
                    fileType
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'data-item file-size' },
                  React.createElement(
                    'label',
                    { 'for': 'size' },
                    'Size'
                  ),
                  ' ',
                  React.createElement(
                    'span',
                    { className: 'size' },
                    fileSize
                  )
                )
              ),
              React.createElement(
                'div',
                { className: 'openpublish-data' },
                React.createElement(
                  'div',
                  { className: 'data-item bitstore-uri' },
                  React.createElement(
                    'label',
                    { 'for': 'uri' },
                    'URI'
                  ),
                  React.createElement(
                    'span',
                    { className: 'uri' },
                    fileDropState == 'uploading' ? 'uploading to bitstore' : displayUri
                  ),
                  React.createElement('input', { className: 'input', type: 'text', ref: 'bitstore-deposit-value', name: 'bitstore-deposit-value', style: { display: bitstoreState != 'no balance' ? 'none' : '' } }),
                  React.createElement(
                    'span',
                    { className: 'upload-container', style: { display: fileDropState != 'scanned' ? 'none' : '' } },
                    React.createElement(
                      'button',
                      { className: 'upload-to-bitstore button', onClick: this.uploadToBitstore },
                      'Upload To Bitstore'
                    ),
                    React.createElement(
                      'span',
                      { className: 'price' },
                      '100 bits ($0.02)'
                    )
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'data-item file-title' },
                  React.createElement(
                    'label',
                    { 'for': 'title' },
                    'Title'
                  ),
                  React.createElement('input', { className: 'input', type: 'text', ref: 'title', name: 'title' })
                ),
                React.createElement(
                  'div',
                  { className: 'data-item file-keywords' },
                  React.createElement(
                    'label',
                    { 'for': 'keywords' },
                    'Keywords'
                  ),
                  React.createElement('input', { className: 'input', type: 'text', ref: 'keywords', name: 'keywords' })
                )
              )
            ),
            React.createElement(
              'p',
              { className: 'transfer-definition' },
              'transferable only with the Open Publish protocol on the Bitcoin blockchain by the holder of the corresponding private keys.'
            ),
            React.createElement(
              'p',
              { className: 'witness-definition' },
              React.createElement(
                'span',
                { className: 'in-witness-whereof' },
                'In Witness Whereof,'
              ),
              ' this document is embedded in the Bitcoin blockchain and secured by a minimum of three confirmations.'
            ),
            React.createElement(
              'button',
              { disabled: fileDropState != 'uploaded', className: 'register-with-openpublish button', onClick: this.registerWithOpenPublish },
              'Sign and Propagate'
            )
          )
        )
      )
    );
  }
});

module.exports = ImagePublisher;

//this.updateBitstoreBalance();