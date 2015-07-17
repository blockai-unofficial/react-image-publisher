var React = require('react');
var openpublish = require('openpublish');
var bitstore = require('bitstore');
var shasum = require('shasum');
var InlineCss = require('react-inline-css');

var BitstoreMetaTable = require('./bitstore-meta-table');
var GuideText = require('./guide-text');
var Preview = require('./preview');
var Embed = require('./embed');

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
      // title: title, // get from UI
      // keywords: keywords, // get from UI
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
    var bitstoreMeta = this.state.bitstoreMeta;
    return (
      <InlineCss stylesheet="
        & * {
          box-sizing: border-box;
          font-smoothing: antialiased;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          font-family: 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif;
        }
        & ::selection {
          color: #FFFFFF;
          background: rgba(52, 73, 94, 0.99);
          text-shadow: none;
        }
        & ul {
          padding: 0;
        }
        & li {
          list-style-type: none;
        }
        & .section {
          margin-bottom: 52px;
        }
        & .section:last-child {
          margin-bottom: 0;
        }
        & .react-image-publisher {
          height: 100%;
        }
        & .file-drop-area {
          position: relative;
          display: -webkit-box;
          display: -moz-box;
          display: -ms-flexbox;
          display: -webkit-flex;
          display: flex;
          align-items: center;
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
          width: 100%;
          -webkit-align-self: center;
          text-align: center;
        }
        & .container {
          max-width: 500px;
          margin: auto;
        }
        & .guide p {
          color: #34495E;
          font-size: 18px;
          line-height: 1.72222;
          margin: 0 0 15px 0;
        }
        & .guide p:last-child {
          margin: 0;
        }
        & .guide a {
          color: #4169E1;
        }
        & .guide-note {
          font-weight: bold;
        }
        & .input-group {
          display: -webkit-box;
          display: -moz-box;
          display: -ms-flexbox;
          display: -webkit-flex;
          display: flex;
          width: 100%;
          margin-bottom: 8px;
        }
        & .input {
          display: block;
          flex: 8;
          -webkit-flex: 8;
          width: 80%;
          height: 62px;
          margin: 0;
          padding: 8px 18px;
          border: 2px solid #BDC3C7;
          font-size: 15px;
          color: #34495E;
        }
        & .input:focus{
          border-color: #1ABC9C;
          outline: none;
        }
        & .label {
          display: -webkit-box;
          display: -moz-box;
          display: -ms-flexbox;
          display: -webkit-flex;
          display: flex;
          flex: 2;
          -webkit-flex: 2;
          -webkit-align-self: center;
          -webkit-align-items: center;
          align-items: center;
          width: 20%;
          height: 62px;
          padding: 0px 0px 0px 16px;
          border-top: 2px solid #BDC3C7;
          border-bottom: 2px solid #BDC3C7;
          border-left: 2px solid #BDC3C7;
          font-size: 15px;
          font-weight: bold;
          color: #34495E;
        }
        & .button {
          position: relative;
          width: 100%;
          margin-bottom: 32px;
          padding: 14px 8px;
          font-size: 32px;
          border: none;
          background-color: #1ABC9C;
          color: #FFFFFF;
          cursor: pointer;
          text-align: center;
        }
        & .button:hover {
          background-color: #48C9B0;
        }
        & .button:focus {
          outline: none;
        }
        & .title {
          margin: 2px 0 20px;
          color: #34495E;
          font: bold 23px/40px 'Helvetica Neue', Helvetica, Roboto, Arial, sans-serif;
        }
        & .image-preview {
          display: -webkit-box;
          display: -moz-box;
          display: -ms-flexbox;
          display: -webkit-flex;
          display: flex;
          margin: auto;
          max-width: 100%;
          max-height: 500px;
          border-style: dashed;
          border-color: #5DADE2;
        }
        & .info {
          color: #34495E;
        }
        & .info-table li {
          display: -webkit-box;
          display: -moz-box;
          display: -ms-flexbox;
          display: -webkit-flex;
          display: flex;
          height: 52px;
          border-top: 2px solid #BDC3C7;
          border-left: 2px solid #BDC3C7;
          border-right: 2px solid #BDC3C7;
        }
        & .info-table li:last-child {
          border-bottom: 2px solid #BDC3C7;
        }
        & .info-table-title {
          display: -webkit-box;
          display: -moz-box;
          display: -ms-flexbox;
          display: -webkit-flex;
          display: flex;
          flex: 2.4;
          -webkit-flex: 2.4;
          height: 100%;
          align-items: center;
          -webkit-align-self: center;
          -webkit-align-items: center;
          padding: 0px 0px 0px 16px;
          border-right: 2px solid #BDC3C7;
          font-weight: bold;
          text-align: left;
        }
        & .info-table-result {
          display: -webkit-box;
          display: -moz-box;
          display: -ms-flexbox;
          display: -webkit-flex;
          display: flex;
          flex: 8;
          -webkit-flex: 8;
          height: 100%;
          align-items: center;
          -webkit-align-self: center;
          -webkit-align-items: center;
          padding: 0px 16px 0px 16px;
        }
        & .info-table-result a {
          display: block;
          width: 318px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #4169E1;
        }
      ">
        <div className='react-image-publisher'>

          <div
            className='file-drop-area'
            onDragOver={this.dragOver}
            onDragEnd={this.dragEnd}
            onDrop={this.drop}
            style={{ borderColor: fileDropState === "scanned" || fileDropState === "uploaded" || fileDropState === "registered" ? '#1ABC9C' : ''}}
          >
            <div className='file-drop-state'>
              {fileDropState ? "File is " + fileDropState : 'Drop file here to begin'}
            </div>
          </div>

          <div className='container'>

            <GuideText fileDropState={fileDropState} />

            <button className='upload-to-bitstore button' onClick={this.uploadToBitstore} style={{display: fileDropState != "scanned" ? 'none' : ''}}>
              Upload To Bitstore
            </button>

            <button className='register-with-openpublish button' onClick={this.registerWithOpenPublish} style={{display: fileDropState != "uploaded" ? 'none' : ''}}>
              Register With OpenPublish
            </button>

            <div className='inputs section' style={{display: fileDropState != "uploaded" ? 'none' : ''}}>

              <div className='input-group'>
                <label className='label'>Title</label>
                <input className='input' type='text' name='title' />
              </div>

              <div className='input-group'>
                <label className='label'>Keywords</label>
                <input className='input' type='text' name='keywords' />
              </div>

            </div>

            <BitstoreMetaTable fileDropState={fileDropState} bitstoreMeta={bitstoreMeta} />

            <Preview fileDropState={fileDropState} filePreview={imgPreview} />

            <Embed fileDropState={fileDropState} />


          </div>
        </div>
      </InlineCss>
    )
  }
});

module.exports = ImagePublisher
