var React = require('react');
var openpublish = require('openpublish');
var bitstore = require('bitstore');
var shasum = require('shasum');
var InlineCss = require('react-inline-css');

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
  getInitialState: function() {
    return {
      signedPayload: false,
      fileInfo: false,
      bitstoreMeta: false,
      bitstoreDepositAddress: false,
      bitstoreBalance: false,
      fileDropState: false,
      fileSha1: false,
      payloadsLength: 0,
      propagationStatus: ""
    }
  },
  topUpBalance: function() {
    var component = this;
    var commonWallet = this.props.commonWallet;
    var value; // wire up to UI
    var destinationAddress; // wire up to UI
    commonWallet.createTransactionForValueToDestinationAddress({
      destinationAddress: destinationAddress,
      value: value,
    }, function(err, signedTxHex) {
      commonBlockchain.Transactions.Propagate(signedTxHex, function(err, receipt) {
        if (err) {
          return;
        }
        component.setState({
          bitstoreState: "waiting for confirmation"
        });
        var checkBitstoreBalance = function(options) {
          var retryAttempts = options.retryAttempts;
          bitstoreClient.wallet.get(function (err, res) {
            var bitstoreBalance = res.body.balance;
            var bitstoreDepositAddress = res.body.deposit_address;
            component.setState({
              bitstoreDepositAddress: bitstoreDepositAddress,
              bitstoreBalance: bitstoreBalance,
            });
            if (bitstoreBalance <= 0) {
              component.setState({
                bitstoreState: "still waiting for confirmation"
              });
              return setTimeout(function() {
                if (retryAttempts > 0) {
                  return checkBitstoreBalance(retryAttempts--);
                }
                component.setState({
                  bitstoreState: "done waiting for confirmation"
                });
              }, 2000);
            }
            component.setState({
              bitstoreState: "confirmed",
              fileDropState: "scanned"
            });
          });
        };

        checkBitstoreBalance({
          retryAttempts: 5
        });

      });
    });
  },
  registerWithOpenPublish: function() {
    var component = this;
    var onStartRegisterWithOpenPublish = this.props.onStartRegisterWithOpenPublish;
    var onEndRegisterWithOpenPublish = this.props.onEndRegisterWithOpenPublish;
    var fileSha1 = this.state.fileSha1;
    var bitstoreMeta = this.state.bitstoreMeta;
    var fileDropState = this.state.fileDropState;
    var fileInfo = this.state.fileInfo;
    var commonWallet = this.props.commonWallet;
    var commonBlockchain = this.props.commonBlockchain;
    if (!bitstoreMeta || !bitstoreMeta.uri || fileDropState != "uploaded" || !fileInfo || !fileInfo.file || !fileSha1) {
      return;
    }
    this.setState({
      fileDropState: "registering"
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
    }, function(err, openPublishReceipt) {
      component.setState({
        fileDropState: "registered"
      });
      if (onEndRegisterWithOpenPublish) {
        onEndRegisterWithOpenPublish(false, openPublishReceipt);
      }
    });
  },
  uploadToBitstore: function() {
    var component = this;
    var onStartUploadToBitstore = this.props.onStartUploadToBitstore;
    var onEndUploadToBitstore = this.props.onEndUploadToBitstore;
    var commonWallet = this.props.commonWallet;
    var bitstoreClient = this.props.bitstoreClient || bitstore(commonWallet);
    var fileInfo = this.state.fileInfo;
    var fileDropState = this.state.fileDropState;
    var fileSha1 = this.state.fileSha1;
    if (fileDropState != "scanned" || !fileInfo || !fileInfo.file || !fileSha1) {
      return;
    }
    bitstoreClient.files.meta(fileSha1, function(err, res) {
      var bitstoreMeta = res.body;
      if (bitstoreMeta.size) { // needs a more robust check
        component.setState({
          bitstoreStatus: "existing",
          bitstoreMeta: bitstoreMeta,
          fileDropState: "uploaded"
        });
        return;
      }
      bitstoreClient.wallet.get(function (err, res) {
        var bitstoreBalance = res.body.balance;
        var bitstoreDepositAddress = res.body.deposit_address;
        component.setState({
          bitstoreDepositAddress: bitstoreDepositAddress,
          bitstoreBalance: bitstoreBalance,
        });
        if (bitstoreBalance <= 0) {
          component.setState({
            bitstoreState: "no balance"
          });
          return;
        }
        component.setState({
          bitstoreClient: bitstoreClient,
          fileDropState: "uploading"
        });
        if (onStartUploadToBitstore) {
          onStartUploadToBitstore(false, {
            bitstoreBalance: bitstoreBalance,
            bitstoreDepositAddress: bitstoreDepositAddress,
            fileInfo: fileInfo
          });
        }
        bitstoreClient.files.put(fileInfo.file, function(error, res) {
          var bitstoreMeta = res.body;
          component.setState({
            bitstoreStatus: "new",
            bitstoreMeta: bitstoreMeta,
            fileDropState: "uploaded"
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
  dragOver: function (event) {
    event.stopPropagation();
    event.preventDefault();
  },
  dragEnd: function(event) {
    event.stopPropagation();
    event.preventDefault();
  },
  drop: function(event) {
    event.preventDefault();
    var component = this;
    var file = event.dataTransfer.files[0];
    component.setState({
      fileDropState: "scanning"
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
        fileDropState: "scanned",
        fileInfo: fileInfo
      });
      if (component.props.onFileDrop) {
        component.props.onFileDrop(false, fileInfo);
      }
    };
    reader.readAsBinaryString(file);


    var preview  = new FileReader();
    preview.onload = function (event) {
      var imagePreviewDataURL = event.target.result;
      component.setState({
        imgPreviewDataURL: imagePreviewDataURL
      });
      if (component.props.onImagePreviewDataURL) {
        component.props.onImagePreviewDataURL(false, imagePreviewDataURL);
      }
    }
    preview.readAsDataURL(file);
  },
  render: function () {
    var fileDropState = this.state.fileDropState;
    var imgPreview = this.state.imgPreviewDataURL ? <img className="image-preview" src={this.state.imgPreviewDataURL} /> : false;
    return (
      <InlineCss stylesheet="
        & * {
          box-sizing: border-box;
          font-smoothing: antialiased;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        & .file-drop-area {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 200px;
          margin-bottom: 32px;
          padding: 3px 0 3px 0;
          border-style: dashed;
          border-color: #4169E1;
          background-color: #F2F3F4;
          color: #34495E;
          font-size: 32px;
          font-family: 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif;
        }
        & .file-drop-area:hover {
          border-color: #5DADE2;
        }
        & .file-drop-state {
          margin-bottom: 18px;
          height: 18px;
          color: #34495E;
          font-size: 16px;
          font-family: 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif;
          text-align: right;
        }
        & .input {
          display: block;
          width: 100%;
          height: 42px;
          padding: 8px 12px;
          margin-bottom: 8px;
          border: 2px solid #BDC3C7;
          font-size: 15px;
          font-weight: bold;
          color: #34495E;
        }
        & .button {
          position: relative;
          display: flex;
          margin-left: auto;
          padding: 10px 19px;
          font-size: 17px;
          border: none;
          background-color: #2ECC71;
          color: #FFFFFF;
          cursor: pointer;
        }
        & .image-preview {
          max-height: 194px;
        }
      ">
        <div className='react-image-publisher'>
          <div className="file-drop-state" style={{visibility: fileDropState ? 'visible' : 'hidden'}}>{fileDropState ? "File is " + fileDropState : false}</div>
          <div className="file-drop-area" onDragOver={this.dragOver} onDragEnd={this.dragEnd} onDrop={this.drop} style={{borderColor: fileDropState === "scanned" || fileDropState === "uploaded" ? '#2ECC71' : ''}}>
            { imgPreview ? {imgPreview} : 'Drop file here to upload' }
          </div>
          <button className='upload-to-bitstore button' onClick={this.uploadToBitstore} style={{display: fileDropState != "scanned" ? 'none' : ''}}>Upload To Bitstore</button>
          <button className='register-with-openpublish button' onClick={this.registerWithOpenPublish} style={{display: fileDropState != "uploaded" ? 'none' : ''}}>Register With Open Publish</button>
        </div>
      </InlineCss>
    )
  }
});

module.exports = ImagePublisher
