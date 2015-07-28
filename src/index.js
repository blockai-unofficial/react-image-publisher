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
  getInitialState: function() {
    return {
      signedPayload: false,
      fileInfo: false,
      bitstoreMeta: false,
      bitstoreDepositAddress: false,
      bitstoreBalance: false,
      fileDropState: false,
      fileSha1: false,
      verifiedBitstorePayment: false,
      verifiedRegisterPayment: false,
      payloadsLength: 0,
      propagationStatus: "",
      openPublishReceipt: false,
      bitstoreUploadProgress: 0,
      fileScanProgress: 0,
      registerProgress: 0,
      registeringMessage: "Initializing transactions..."
    }
  },
  componentWillMount: function() {
    var commonWallet = this.props.commonWallet;
    if (commonWallet) {
      var bitstoreClient = this.props.bitstoreClient || bitstore(commonWallet);
      this.setState({
        bitstoreClient: bitstoreClient
      });
    }
  },
  componentDidMount: function() {
    //this.updateBitstoreBalance();
  },
  onVerifyBitstorePaymentToggle: function(event) {
    this.setState({
      verifiedBitstorePayment: event.target.checked
    })
  },
  onVerifyRegisterPaymentToggle: function(event) {
    this.setState({
      verifiedRegisterPayment: event.target.checked
    })
  },
  updateBitstoreBalance: function(callback) {
    var component = this;
    var bitstoreClient = this.state.bitstoreClient;
    bitstoreClient.wallet.get(function (err, res) {
      var bitstoreBalance = res.body.balance;
      var bitstoreDepositAddress = res.body.deposit_address;
      component.setState({
        bitstoreDepositAddress: bitstoreDepositAddress,
        bitstoreBalance: bitstoreBalance,
      });
      if (callback) {
        callback(false, bitstoreBalance);
      }
    });
  },
  topUpBalance: function() {
    var component = this;
    var commonWallet = this.props.commonWallet;
    var value; // wire up to UI
    var destinationAddress = this.state.bitstoreDepositAddress;
    commonWallet.createTransaction({
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
          component.updateBitstoreBalance(function(err, bitstoreBalance) {
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
  getPayloadsLength: function(options) {
    var component = this;
    var commonBlockchain = this.props.commonBlockchain;
    var commonWallet = this.props.commonWallet;
    var bitstoreMeta = options.bitstoreMeta || this.state.bitstoreMeta;
    var fileInfo = options.fileInfo || this.state.fileInfo;
    var fileSha1 = options.fileSha1 || this.state.fileSha1;
    openpublish.getPayloadsLength({
      uri: bitstoreMeta.uri,
      sha1: fileSha1,
      file: fileInfo.file,
      // title: title, // get from UI
      // keywords: keywords, // get from UI
      commonWallet: commonWallet,
      commonBlockchain: commonBlockchain
    }, function(err, payloadsLength) {
      component.setState({
        payloadsLength: payloadsLength
      });
    });
  },
  onBuildProgress: function(e) {
    // the first half of the registration process is building the transactions...
    this.setState({
      registeringMessage: "Building and Signing transactions...",
      registerProgress: Math.round((e.count / (e.payloadsLength * 2)) * 100) // range: 0% to 50%
    });
  },
  onPropagateProgress: function(e) {
    // the second half of the registration process is propagating the transactions...
    this.setState({
      registeringMessage: "Propagating transactions...",
      registerProgress: Math.round(( (e.transactionTotal + e.count) / (e.transactionTotal * 2) ) * 100) // range: 50% to 100%
    });
  },
  readyToRegister: function() {
    return (this.state.bitstoreMeta && this.state.bitstoreMeta.uri && this.state.fileInfo && this.state.fileInfo.file && this.state.fileSha1);
  },
  registerWithOpenPublish: function() {
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
      commonBlockchain: commonBlockchain,
      propagationStatus: component.onPropagateProgress,
      buildStatus: component.onBuildProgress
    }, function(err, openPublishReceipt) {
      component.setState({
        fileDropState: "registered",
        openPublishReceipt: openPublishReceipt
      });
      if (onEndRegisterWithOpenPublish) {
        onEndRegisterWithOpenPublish(false, openPublishReceipt);
      }
    });
  },
  onBitstoreUploadProgress: function(e) {
    if (!e.percent) {
      return;
    }
    this.setState({
      bitstoreUploadProgress: parseInt(e.percent)
    });
  },
  readyToUpload: function() {
    return (this.state.fileInfo && this.state.fileInfo.file && this.state.fileSha1);
  },
  uploadToBitstore: function() {
    var startTime = +(new Date());
    this.setState({
      bitstoreState: "checking file"
    });
    var component = this;
    var onStartUploadToBitstore = this.props.onStartUploadToBitstore;
    var onEndUploadToBitstore = this.props.onEndUploadToBitstore;
    var commonWallet = this.props.commonWallet;
    if (commonWallet) {
      var bitstoreClient = this.state.bitstoreClient || this.props.bitstoreClient || bitstore(commonWallet);
    }
    var bitstoreClient = this.state.bitstoreClient;
    var fileInfo = this.state.fileInfo;
    var fileSha1 = this.state.fileSha1;
    if (!this.readyToUpload()) {
      return;
    }
    bitstoreClient.files.meta(fileSha1, function(err, res) {
      var bitstoreMeta = res.body;
      if (bitstoreMeta.size) { // needs a more robust check
        component.setState({
          bitstoreState: "",
          bitstoreStatus: "existing",
          bitstoreMeta: bitstoreMeta,
          fileDropState: "uploaded"
        });
        return;
      }
      component.setState({
        bitstoreState: "checking balance"
      });
      bitstoreClient.wallet.get(function (err, res) {
        var bitstoreBalance = res.body.balance;
        var bitstoreDepositAddress = res.body.deposit_address;
        component.setState({
          bitstoreDepositAddress: bitstoreDepositAddress,
          bitstoreBalance: bitstoreBalance
        });
        if (bitstoreBalance <= 0) {
          component.setState({
            bitstoreState: "no balance"
          });
          return;
        }
        component.setState({
          bitstoreClient: bitstoreClient,
          fileDropState: "uploading",
          bitstoreState: "has balance"
        });
        if (onStartUploadToBitstore) {
          onStartUploadToBitstore(false, {
            bitstoreBalance: bitstoreBalance,
            bitstoreDepositAddress: bitstoreDepositAddress,
            fileInfo: fileInfo
          });
        }
        if (!component.props.disableProgress) {
          fileInfo.file.onProgress = component.onBitstoreUploadProgress;
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
          component.getPayloadsLength({bitstoreMeta: bitstoreMeta, fileInfo: fileInfo, fileSha1: fileSha1});
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

    var commonWallet = this.props.commonWallet;
    if (commonWallet) {
      var bitstoreClient = this.state.bitstoreClient || this.props.bitstoreClient || bitstore(commonWallet);
      this.setState({
        bitstoreClient: bitstoreClient
      });
    }

    var component = this;
    var file = event.dataTransfer.files[0];
    component.setState({
      fileDropState: "scanning",
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
        fileDropState: "scanned",
        fileInfo: fileInfo
      });
      if (component.props.onFileDrop) {
        component.props.onFileDrop(false, fileInfo);
      }
    };
    if (!component.props.disableProgress) {
      reader.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
          var percent = Math.round((e.loaded / e.total) * 100);
          component.setState({
            fileScanProgress: percent
          });
        }
      });
    }
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
    var bitstoreState = this.state.bitstoreState;
    var bitstoreBalance = this.state.bitstoreBalance;
    var bitstoreDepositAddress = this.state.bitstoreDepositAddress;
    var commonWallet = this.props.commonWallet || { address: ""};

    var fileName = this.state.fileInfo ? this.state.fileInfo.file.name : "";
    var fileType = this.state.fileInfo ? this.state.fileInfo.file.type : "";
    var fileSize = this.state.fileInfo ? this.state.fileInfo.file.size : "";
    var fileSha1 = this.state.fileSha1;
    var displayUri = bitstoreMeta.uri ? bitstoreMeta.uri.split("//")[1].split("/")[0] + "/.../" + fileSha1.slice(0,3) + "..." +  fileSha1.slice(-3, 40) : "";

    var readyToScan = true;
    var readyToRegister = this.readyToRegister();
    var readyToUpload = this.readyToUpload();

    var scanFile;
    if (readyToScan && !this.state.fileInfo) {
      scanFile = (
        <div className={'well well-lg file-drop-area ' + (fileDropState ? 'file-exists' : '')} onDragOver={this.dragOver} onDragEnd={this.dragEnd} onDrop={this.drop} >
          <div className='file-drop-state'>
            {fileDropState ? "" : <h4>Drop Image File Here</h4>}
            {fileDropState == "scanning" ?  <h4>Scanning File</h4> : false }
          </div>
          { imgPreview }
        </div>
      )
    }

    var fileInformation, scanPrompt;
    if (this.state.fileInfo && fileSha1) {
      fileInformation = (
        <div className="file-info panel panel-default">
          <div className='file-drop-state'></div>
          <div className="panel-body">{ imgPreview }</div>
          <table className="table">
            <tr>
              <th>Name</th>
              <td>{fileName}</td>
            </tr>
            <tr>
              <th>SHA1</th>
              <td>{fileSha1}</td>
            </tr>
            <tr>
              <th>Size</th>
              <td>{fileSize} bytes</td>
            </tr>
            <tr>
              <th>Type</th>
              <td>{fileType}</td>
            </tr>
            <tr>
              <th>URI</th>
              <td><a href={bitstoreMeta.uri}>{displayUri}</a></td>
            </tr>
          </table>
        </div>
      )
    }
    else {
      scanPrompt = (
        <p className="alert alert-info">
          Drag and drop an image on the area to the left to get started.
        </p>
      )
    }

    var bitstoreMetaInformation, uploadFile;
    if (bitstoreMeta) {
      bitstoreMetaInformation = (
        <div className="bitstore-meta-info panel panel-default">
          <div className="panel-heading">Bitstore File Information</div>
          <table className="table">
            <tr>
              <th>URI</th>
              <td><a href={bitstoreMeta.uri}>{displayUri}</a></td>
            </tr>
          </table>
        </div>
      )
    }
    else if (readyToUpload && fileDropState != "uploading" && bitstoreState != "checking file" && bitstoreState != "checking balance") {
      uploadFile = (
        <div className="upload-file">
          <p className="alert alert-info">
            Upload your image to Bitstore.
          </p>
          <p>
            <label for="verify-bitstore-payment"><input type="checkbox" onChange={this.onVerifyBitstorePaymentToggle} ref="verifyBitstorePayment" name="verify-bitstore-payment" className="verify-bitstore-payment" /> I agree to the terms of service for Bitstore and to pay 100 bits for hosting and distribution costs.</label>
          </p>
          <input className='input' type='text' ref='bitstore-deposit-value' name='bitstore-deposit-value' style={{display: bitstoreState != "no balance" ? 'none' : ''}} />
          <button disabled={!this.state.verifiedBitstorePayment} className='btn btn-lg btn-primary btn-block upload-to-bitstore button' onClick={this.uploadToBitstore}>
            Upload To Bitstore
          </button>
        </div>
      );
    };

    var bitstoreUploadProgress;
    if (fileDropState == "uploading") {
      bitstoreUploadProgress = (
        <div>
          <p className="alert alert-info">
            Uploading file to Bitstore...
          </p>
          <div className="progress">
            <div className="progress-bar" style={{width: this.state.bitstoreUploadProgress + "%"}}></div>
          </div>
        </div>
      )
    }

    var bitstoreCheckingFile;
    if (bitstoreState == "checking file") {
      bitstoreCheckingFile = (
        <p className="alert alert-info">
          Checking for existing file...
        </p>
      )
    }

    var bitstoreAccountInformation;
    if (bitstoreDepositAddress) {
      bitstoreAccountInformation = (
        <div className="bitstore-account-info panel panel-default">
          <div className="panel-heading">Bitstore Account Information</div>
          <table className="table">
            <tr>
              <th>Balance</th>
              <td>{bitstoreBalance}</td>
            </tr>
            <tr>
              <th>Deposit Address</th>
              <td>{bitstoreDepositAddress}</td>
            </tr>
          </table>
        </div>
      )
    }

    var bitstoreCheckingBalance;
    if (bitstoreState == "checking balance") {
      bitstoreCheckingBalance = (
        <p className="alert alert-info">
          Checking Bitstore balance...
        </p>
      )
    }

    var registerFile;
    if (readyToRegister && fileDropState != "registering" && fileDropState != "registered") {
      registerFile = (
        <div className="register-file">
          <p className="alert alert-info">
            You are now ready to register your image with Open Publish.
          </p>
          <p>
            <label for="verify-register-payment"><input type="checkbox" onChange={this.onVerifyRegisterPaymentToggle} ref="verifyRegisterPayment" name="verify-register-payment" className="verify-register-payment"/> I agree to be the rightful owner of this media and to pay 60 bits in Bitcoin network transaction fees.</label>
          </p>
          <button disabled={!this.state.verifiedRegisterPayment} className='btn btn-lg btn-primary btn-block register-with-openpublish' onClick={this.registerWithOpenPublish}>
            Register Image
          </button>
        </div>
      );
    }

    var registerProgress;
    if (fileDropState == "registering") {
      registerProgress = (
        <div>
          <p className="alert alert-info">
            {this.state.registeringMessage}
          </p>
          <div className="progress">
            <div className="progress-bar" style={{width: this.state.registerProgress + "%"}}></div>
          </div>
        </div>
      )
    }

    var openPublishReceipt = this.state.openPublishReceipt;
    var openPublishReceiptView;
    if (openPublishReceipt) {
      var txid = openPublishReceipt.blockcastTx.txid;
      var displayTxid = txid.slice(0, 12) + "..." + txid.slice(-12,64);
      var transactionTotal = openPublishReceipt.blockcastTx.transactionTotal;
      var blocktrailLink = <a href={"https://www.blocktrail.com/tBTC/tx/" + txid}>Blocktrail</a>;
      openPublishReceiptView = (
        <div>
          <p className="alert alert-success open-publish-receipt">
          The transaction that represents your Open Publish registration is propagating and waiting for confirmation.
          </p>
          <div className="registration-info panel panel-default">
            <div className="panel-heading">Registration Information</div>
            <table className="table">
              <tr>
                <th>txid</th>
                <td>{displayTxid}</td>
              </tr>
              <tr>
                <th>Transaction count</th>
                <td>{transactionTotal}</td>
              </tr>
              <tr>
                <th>Transaction info</th>
                <td>{blocktrailLink}</td>
              </tr>
            </table>
          </div>
        </div>
      )
    }

    return (
      <div className='react-image-publisher'>
        <h3>Register an image with Open Publish</h3>
        <div className="row">
          <div className="col-sm-6">
            {scanFile}
            {fileInformation}
          </div>
          <div className="col-sm-6">
            {scanPrompt}
            {bitstoreCheckingFile}
            {bitstoreCheckingBalance}
            {bitstoreUploadProgress}
            {uploadFile}
            {registerFile}
            {registerProgress}
            {openPublishReceiptView}
          </div>   
        </div>
      </div>
    )
  }
});

module.exports = ImagePublisher
