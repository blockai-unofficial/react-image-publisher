'use strict';

var React = require('react');
var openpublish = require('openpublish');
var bitstore = require('bitstore');
var shasum = require('shasum');

var ImagePublisher = React.createClass({
  displayName: 'ImagePublisher',
  propTypes: {
    commonBlockchain: React.PropTypes.object.isRequired,
    commonWallet: React.PropTypes.object,
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
      propagationStatus: '',
      openPublishReceipt: false
    };
  },
  componentWillMount: function componentWillMount() {
    var commonWallet = this.props.commonWallet;
    if (commonWallet) {
      var bitstoreClient = this.props.bitstoreClient || bitstore(commonWallet);
      this.setState({
        bitstoreClient: bitstoreClient
      });
    }
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
      value: value
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
  readyToRegister: function readyToRegister() {
    return this.state.bitstoreMeta && this.state.bitstoreMeta.uri && this.state.fileInfo && this.state.fileInfo.file && this.state.fileSha1;
  },
  registerWithOpenPublish: function registerWithOpenPublish() {
    var component = this;
    var onStartRegisterWithOpenPublish = this.props.onStartRegisterWithOpenPublish;
    var onEndRegisterWithOpenPublish = this.props.onEndRegisterWithOpenPublish;
    var fileSha1 = this.state.fileSha1;
    var bitstoreMeta = this.state.bitstoreMeta;
    var fileInfo = this.state.fileInfo;
    // var title = this.refs.title.getDOMNode().value;
    // var keywords = this.refs.keywords.getDOMNode().value;
    var commonWallet = this.props.commonWallet;
    var commonBlockchain = this.props.commonBlockchain;
    if (!this.readyToRegister()) {
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
        fileDropState: 'registered',
        openPublishReceipt: openPublishReceipt
      });
      if (onEndRegisterWithOpenPublish) {
        onEndRegisterWithOpenPublish(false, openPublishReceipt);
      }
    });
  },
  readyToUpload: function readyToUpload() {
    return this.state.fileInfo && this.state.fileInfo.file && this.state.fileSha1;
  },
  uploadToBitstore: function uploadToBitstore() {
    var component = this;
    var onStartUploadToBitstore = this.props.onStartUploadToBitstore;
    var onEndUploadToBitstore = this.props.onEndUploadToBitstore;
    var commonWallet = this.props.commonWallet;
    if (commonWallet) {
      var bitstoreClient = this.state.bitstoreClient || this.props.bitstoreClient || bitstore(commonWallet);
      this.setState({
        bitstoreClient: bitstoreClient
      });
    }
    var bitstoreClient = this.state.bitstoreClient;
    var fileInfo = this.state.fileInfo;
    var fileSha1 = this.state.fileSha1;
    if (!this.readyToUpload()) {
      return;
    }
    bitstoreClient.files.meta(fileSha1, function (err, res) {
      console.log('bitstoreClient.files.meta', fileSha1, res);
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
        console.log('bitstoreClient.wallet.get', commonWallet.address, res);
        var bitstoreBalance = res.body.balance;
        var bitstoreDepositAddress = res.body.deposit_address;
        component.setState({
          bitstoreDepositAddress: bitstoreDepositAddress,
          bitstoreBalance: bitstoreBalance
        });
        console.log('bitstoreBalance', bitstoreBalance);
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
        console.log('about to upload...');
        bitstoreClient.files.put(fileInfo.file, function (error, res) {
          console.log('bitstoreClient.files.put', fileInfo.file, res);
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
      fileDropState: 'scanning',
      fileInfo: false,
      bitstoreMeta: false,
      fileSha1: false
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
    var commonWallet = this.props.commonWallet || { address: '' };

    var fileName = this.state.fileInfo ? this.state.fileInfo.file.name : '';
    var fileType = this.state.fileInfo ? this.state.fileInfo.file.type : '';
    var fileSize = this.state.fileInfo ? this.state.fileInfo.file.size : '';
    var fileSha1 = this.state.fileSha1;
    var displayUri = bitstoreMeta.uri ? bitstoreMeta.uri.split('//')[1].split('/')[0] + '/.../' + fileSha1.slice(0, 3) + '...' + fileSha1.slice(-3, 40) : '';

    var readyToScan = true;
    var readyToRegister = this.readyToRegister();
    var readyToUpload = this.readyToUpload();

    var openPublishReceipt = this.state.openPublishReceipt;
    var openPublishReceiptView;
    if (openPublishReceipt) {
      openPublishReceiptView = React.createElement(
        'div',
        { className: 'open-publish-receipt' },
        React.createElement(
          'p',
          null,
          'The transaction that represents your Open Publish registration is propagating and waiting for confirmation: ',
          React.createElement(
            'a',
            { href: 'https://www.blocktrail.com/tBTC/tx/' + openPublishReceipt.blockcastTx.txid },
            openPublishReceipt.blockcastTx.txid
          )
        )
      );
    }

    var scanFile;
    if (readyToScan) {
      scanFile = React.createElement(
        'div',
        { className: 'well well-lg file-drop-area ' + (fileDropState ? 'file-exists' : ''), onDragOver: this.dragOver, onDragEnd: this.dragEnd, onDrop: this.drop },
        React.createElement(
          'div',
          { className: 'file-drop-state' },
          fileDropState ? '' : React.createElement(
            'h4',
            null,
            'Drop Image File Here'
          )
        ),
        imgPreview
      );
    }

    var fileInformation, scanPrompt;
    if (this.state.fileInfo && fileSha1) {
      fileInformation = React.createElement(
        'div',
        { className: 'file-info panel panel-default' },
        React.createElement(
          'div',
          { className: 'panel-heading' },
          'File Information'
        ),
        React.createElement(
          'table',
          { className: 'table' },
          React.createElement(
            'tr',
            null,
            React.createElement(
              'th',
              null,
              'SHA1'
            ),
            React.createElement(
              'td',
              null,
              fileSha1
            )
          ),
          React.createElement(
            'tr',
            null,
            React.createElement(
              'th',
              null,
              'Name'
            ),
            React.createElement(
              'td',
              null,
              fileName
            )
          ),
          React.createElement(
            'tr',
            null,
            React.createElement(
              'th',
              null,
              'Size'
            ),
            React.createElement(
              'td',
              null,
              fileSize,
              ' bytes'
            )
          ),
          React.createElement(
            'tr',
            null,
            React.createElement(
              'th',
              null,
              'Type'
            ),
            React.createElement(
              'td',
              null,
              fileType
            )
          )
        )
      );
    } else {
      scanPrompt = React.createElement(
        'p',
        { className: 'alert alert-info' },
        'Before we can register an image with Open Publish we need to scan it an compute a unique digital fingerprint.'
      );
    }

    var bitstoreMetaInformation, uploadFile;
    if (bitstoreMeta) {
      bitstoreMetaInformation = React.createElement(
        'div',
        { className: 'bitstore-meta-info panel panel-default' },
        React.createElement(
          'div',
          { className: 'panel-heading' },
          'Bitstore Information'
        ),
        React.createElement(
          'table',
          { className: 'table' },
          React.createElement(
            'tr',
            null,
            React.createElement(
              'th',
              null,
              'URI'
            ),
            React.createElement(
              'td',
              null,
              React.createElement(
                'a',
                { href: bitstoreMeta.uri },
                displayUri
              )
            )
          )
        )
      );
    } else if (readyToUpload) {
      uploadFile = React.createElement(
        'div',
        { className: 'upload-file' },
        React.createElement(
          'p',
          { className: 'alert alert-info' },
          'Before we can register an image with Open Publish we need to make sure that is uploaded to a server.',
          React.createElement('br', null),
          React.createElement('br', null),
          'Bitstore is an easy, cheap and convenient service for hosting files.'
        ),
        React.createElement('input', { className: 'input', type: 'text', ref: 'bitstore-deposit-value', name: 'bitstore-deposit-value', style: { display: bitstoreState != 'no balance' ? 'none' : '' } }),
        React.createElement(
          'button',
          { className: 'btn btn-lg btn-primary btn-block upload-to-bitstore button', onClick: this.uploadToBitstore },
          'Upload To Bitstore'
        )
      );
    };

    var registerFile;
    if (readyToRegister) {
      registerFile = React.createElement(
        'div',
        { className: 'register-file' },
        React.createElement(
          'button',
          { disabled: fileDropState != 'uploaded', className: 'btn btn-lg btn-primary btn-block register-with-openpublish', onClick: this.registerWithOpenPublish },
          'Sign and Propagate'
        )
      );
    }

    return React.createElement(
      'div',
      { className: 'react-image-publisher' },
      React.createElement(
        'h3',
        null,
        'Register an image with Open Publish'
      ),
      scanFile,
      scanPrompt,
      fileInformation,
      uploadFile,
      bitstoreMetaInformation,
      registerFile,
      openPublishReceiptView
    );
  }
});

module.exports = ImagePublisher;

//this.updateBitstoreBalance();