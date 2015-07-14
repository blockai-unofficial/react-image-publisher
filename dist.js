'use strict';

var React = require('react');
var openpublish = require('openpublish');
var bitstore = require('bitstore');
var shasum = require('shasum');

var styles = {
  base: {
    height: '100%'
  },
  fileDrop: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 200,
    marginBottom: 20,
    paddingTop: 3,
    paddingBottom: 3,
    borderStyle: 'dashed',
    borderColor: '#4169E1',
    fontSize: 32,
    backgroundColor: '#F2F3F4',
    color: '#34495E'
  },
  imagePreview: {
    maxHeight: 206
  },
  button: {
    position: 'relative',
    display: 'flex',
    marginTop: 20,
    marginLeft: 'auto',
    padding: '10px 19px',
    fontSize: 17,
    border: 'none',
    backgroundColor: '#2ECC71',
    color: '#FFFFFF'
  }
};

var ImagePublisher = React.createClass({
  displayName: 'ImagePublisher',
  propTypes: {
    commonBlockchain: React.PropTypes.object.isRequired,
    commonWallet: React.PropTypes.object.isRequired,
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
  registerWithOpenPublish: function registerWithOpenPublish(event) {
    var component = this;
    var onStartRegisterWithOpenPublish = this.props.onStartRegisterWithOpenPublish;
    var onEndRegisterWithOpenPublish = this.props.onEndRegisterWithOpenPublish;
    var fileSha1 = this.state.fileSha1;
    var bitstoreMeta = this.state.bitstoreMeta;
    var fileDropState = this.state.fileDropState;
    var fileInfo = this.state.fileInfo;
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
      //title: title, // get from UI
      //keywords: keywoards, // get from UI
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
  uploadToBitstore: function uploadToBitstore(event) {
    var component = this;
    var onStartUploadToBitstore = this.props.onStartUploadToBitstore;
    var onEndUploadToBitstore = this.props.onEndUploadToBitstore;
    var commonWallet = this.props.commonWallet;
    var bitstoreClient = this.props.bitstoreClient || bitstore(commonWallet);
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
            fileDropState: 'bitstore needs coin'
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
    var imgPreview = this.state.imgPreviewDataURL ? React.createElement('img', { style: styles.imagePreview, className: 'image-preview', src: this.state.imgPreviewDataURL }) : false;
    return React.createElement(
      'div',
      { className: 'react-image-publisher' },
      React.createElement(
        'div',
        { className: 'file-drop-area', onDragOver: this.dragOver, onDragEnd: this.dragEnd, onDrop: this.drop },
        React.createElement(
          'div',
          { className: 'fileDropState' },
          fileDropState || 'drop file'
        ),
        imgPreview
      ),
      React.createElement(
        'button',
        { className: 'upload-to-bitstore', onClick: this.uploadToBitstore, style: { display: fileDropState != 'scanned' ? 'none' : '' } },
        'Upload To Bitstore'
      ),
      React.createElement(
        'button',
        { className: 'register-with-openpublish', onClick: this.registerWithOpenPublish, style: { display: fileDropState != 'uploaded' ? 'none' : '' } },
        'Register With Open Publish'
      )
    );
  }
});

module.exports = ImagePublisher;

