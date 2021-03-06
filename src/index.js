var React = require('react');
var openpublish = require('openpublish');
var bitstore = require('bitstore');
var shasum = require('shasum');
var bitcoinTxHexToJSON = require('bitcoin-tx-hex-to-json');
var request = require("request");

//  <iframe src="https://www.blockai.com/embed/2dd0b83677ac2271daab79782f0b9dcb4038d659" width="640" height="490" frameBorder="0"/>

var ReactBootstrap = require('react-bootstrap');
var Input = ReactBootstrap.Input;

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
      balance: this.props.balance || 0,
      signedPayload: false,
      fileInfo: false,
      uri: false,
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
      isUpdatingBalance: false,
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
    var component = this;
    if (this.props.balance) {
      component.pollBitstoreBalance({
        retryAttempts: 100
      });
      return;
    }
    setInterval(function() {
      if (!component.state.balance) {
        component.updateBalance(function(err, balance) {
          if (balance > 0) {
            component.pollBitstoreBalance({
              retryAttempts: 100
            });
          }
        });
      }
    }, 3000);
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
  checkIfUpdatingBitstoreBalance: function(callback) {
    //console.log("checkIfUpdatingBitstoreBalance");
    var component = this;
    var commonBlockchain = this.props.commonBlockchain;
    var commonWallet = this.props.commonWallet;
    var bitstoreDepositAddress = this.state.bitstoreDepositAddress;
    if (!commonWallet || !commonWallet.address || !commonBlockchain || !bitstoreDepositAddress) {
      return;
    }
    if (this.state.isUpdatingBalance || this.state.didUpdateBalance) {
      return;
    }
    commonBlockchain.Addresses.Transactions([commonWallet.address], function(err, adrs_txs) {
      var txs = adrs_txs[0];
      var foundUpdatingTx;
      txs.forEach(function(tx) {
        var txDetails = bitcoinTxHexToJSON(tx.txHex);
        txDetails.vout.forEach(function(o) {
          var addr = o.scriptPubKey.addresses[0];
          if (addr == bitstoreDepositAddress) {
            foundUpdatingTx = true;
            // console.log("setState", {
            //   didUpdateBalance: true,
            //   isUpdatingBalance: !(tx.blockHeight > 0)
            // });
            component.setState({
              didUpdateBalance: true,
              isUpdatingBalance: !(tx.blockHeight > 0)
            });
            return;
          }
        });
      });
      if (foundUpdatingTx) {
        return;
      }
      component.setState({
        didUpdateBalance: false,
        isUpdatingBalance: false
      });
    })
  },
  updateBitstoreBalance: function(callback) {
    //console.log("updateBitstoreBalance");
    var component = this;
    var bitstoreClient = this.state.bitstoreClient;
    if (!bitstoreClient) {
      if (callback) {
        callback(true, 0);
      }
      return;
    }
    bitstoreClient.wallet.get(function (err, res) {
      var bitstoreBalance = res.body.total_balance;
      var bitstoreDepositAddress = res.body.deposit_address;
      component.setState({
        bitstoreDepositAddress: bitstoreDepositAddress,
        bitstoreBalance: bitstoreBalance,
      });
      if (callback) {
        callback(false, bitstoreBalance);
      }
      if (bitstoreBalance === 0) {
        component.checkIfUpdatingBitstoreBalance(); // we want to check to see if there are any unconfirmed transactions from the user to bitstoreDepositAddress
      }
    });
  },
  updateBalance: function(callback) {
    //console.log("updateBalance");
    var component = this;
    var commonWallet = this.props.commonWallet;
    var commonBlockchain = this.props.commonBlockchain;
    if (!commonWallet || !commonWallet.address || !commonBlockchain) {
      return;
    }
    commonBlockchain.Addresses.Summary([commonWallet.address], function(err, adrs) { 
      var balance = adrs && adrs[0] ? adrs[0].balance : 0;
      component.setState({
        balance: balance
      });
      if (callback) {
        callback(false, balance);
      }
    });
  },
  pollBitstoreBalance: function(options) {
    //console.log("pollBitstoreBalance", options);
    var component = this;
    var retryAttempts = options.retryAttempts;
    this.updateBitstoreBalance(function(err, bitstoreBalance) {
      if (bitstoreBalance <= 0) {
        if (options.onRetry) {
          options.onRetry(retryAttempts);
        }
        return setTimeout(function() {
          if (retryAttempts > 0) {
            return component.pollBitstoreBalance({retryAttempts: --retryAttempts});
          }
          if (options.onNoConfirmation) {
            options.onNoConfirmation();
          }
        }, 2000);
      }
      if (options.onConfirmation) {
        options.onConfirmation();
      }
    });
  },
  topUpBalance: function(options) {
    //console.log("topUpBalance", options)
    var component = this;
    var commonWallet = this.props.commonWallet;
    var commonBlockchain = this.props.commonBlockchain;
    var value = 30000;
    var destinationAddress = this.state.bitstoreDepositAddress;
    if (!commonWallet || !commonWallet.address || !commonBlockchain || !destinationAddress) {
      return;
    }
    component.setState({
      bitstoreState: "waiting for confirmation",
      isUpdatingBalance: true
    });
    //console.log("creating tx");
    commonWallet.createTransaction({
      destinationAddress: destinationAddress,
      value: value,
    }, function(err, signedTxHex) {
      //console.log("propagating tx");
      commonBlockchain.Transactions.Propagate(signedTxHex, function(err, receipt) {
        if (err) {
          return;
        }
        var totalRetryAttempts = 1000;
        component.pollBitstoreBalance({
          retryAttempts: totalRetryAttempts,
          onRetry: function(retriesRemaining) {
            var retryCount = totalRetryAttempts - retriesRemaining;
            //console.log("still waiting for confirmation", retryCount + "/" + totalRetryAttempts);
            component.setState({
              bitstoreState: "still waiting for confirmation"
            });
          },
          onConfirmation: function() {
            //console.log("confirmed balance updated");
            component.setState({
              bitstoreState: "confirmed",
              fileDropState: "scanned",
              isUpdatingBalance: false
            });
            if (options.onConfirmation) {
              options.onConfirmation();
            }
          },
          onNoConfirmation: function() {
            //console.log("giving up balance update");
            component.setState({
              bitstoreState: "done waiting for confirmation"
            });
            if (options.onNoConfirmation) {
              options.onNoConfirmation();
            }
          }
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
    return (this.state.uri && this.state.fileInfo && this.state.fileInfo.file && this.state.fileSha1);
  },
  registerWithOpenPublish: function() {
    var component = this;
    var onStartRegisterWithOpenPublish = this.props.onStartRegisterWithOpenPublish;
    var onEndRegisterWithOpenPublish = this.props.onEndRegisterWithOpenPublish;
    var fileSha1 = this.state.fileSha1;
    var uri = this.state.uri;
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
      fee: 3000, // this will be dynamic shortly!
      uri: uri,
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
    if ((this.state.isUpdatingBalance && this.state.bitstoreBalance === 0) || (this.state.didUpdateBalance && this.state.bitstoreBalance === 0)) {
      return false;
    }
    return (this.state.fileInfo && this.state.fileInfo.file && this.state.fileSha1);
  },
  onExistingUri: function(event) {
    var component = this;
    this.setState({
      uri: false,
      existingUriError: false,
      checkingExistingUri: true
    });
    var existingUri = this.refs.existingUri.getValue();
    var img = new Image();
    img.onload = function(event) {
      var sha1sumURL = "http://sha1uri-store.d.blockai.com/uri/" + encodeURIComponent(existingUri);
      request(sha1sumURL, function(err, resp, sha1) {
        if (!err && sha1) {
          if (sha1 === component.state.fileSha1) {
            component.setState({uri: existingUri, checkingExistingUri: false});
          }
          else {
            component.setState({existingUriError: "sha1 mismatch", checkingExistingUri: false});
          }
        }
      });
    }
    img.onerror = function(event) {
      component.setState({existingUriError: "not found", checkingExistingUri: false});
    }
    img.src = existingUri;
  },
  existingUriValidationState: function() {
    if (this.state.uri) {
      return "success";
    }
    else if (this.state.existingUriError) {
      return "error";
    }
    return;
  },
  uploadToBitstore: function() {
    var startTime = +(new Date());
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
    if (!this.state.bitstoreBalance && this.state.balance && !this.state.isUpdatingBalance) {
      this.topUpBalance({
        onConfirmation: function() {
          component.uploadToBitstore();
        }
      });
      return;
    }
    if (!this.readyToUpload()) {
      return;
    }
    this.setState({
      bitstoreState: "checking file"
    });
    bitstoreClient.files.meta(fileSha1, function(err, res) {
      var bitstoreMeta = res.body;
      if (bitstoreMeta.size) { // needs a more robust check
        component.setState({
          bitstoreState: "",
          bitstoreStatus: "existing",
          bitstoreMeta: bitstoreMeta,
          uri: bitstoreMeta.uri,
          fileDropState: "uploaded"
        });
        return;
      }
      component.setState({
        bitstoreState: "checking balance"
      });
      bitstoreClient.wallet.get(function (err, res) {
        var bitstoreBalance = res.body.total_balance;
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
            uri: bitstoreMeta.uri,
            fileDropState: "uploaded"
          });
          if (onEndUploadToBitstore) {
            onEndUploadToBitstore(false, {
              bitstoreMeta: bitstoreMeta,
              uri: bitstoreMeta.uri
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
    this.updateBitstoreBalance();
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
      uri: false,
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
     if (!this.props.commonWallet || !this.props.commonWallet.address || !this.props.commonBlockchain) {
      return false;
    }
    if (this.state.balance === 0 && this.props.balance === 0 && this.props.NoBalance && this.props.commonWallet && this.props.commonWallet.address) {
      var NoBalance = this.props.NoBalance;
      return <NoBalance address={this.props.commonWallet.address} intentMessage={"to register an image with Open Publish"}/>;
    }
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
    var uri = this.state.uri;
    var displayUri = uri ? uri.split("//")[1].split("/")[0] + "/.../" + fileSha1.slice(0,3) + "..." +  fileSha1.slice(-3, 40) : "";

    var readyToScan = true;
    var readyToRegister = this.readyToRegister();
    var readyToUpload = this.readyToUpload();

    var noBalance = bitstoreState == "no balance";

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
              <td><a href={uri}>{displayUri}</a></td>
            </tr>
          </table>
        </div>
      )
    }
    else {
      scanPrompt = (
        <p className="alert alert-info">
          Drag and drop an image on the area below to get started.
        </p>
      )
    }

    var bitstoreAccountInformation;
    if (bitstoreDepositAddress) {
      bitstoreAccountInformation = (
        <div className="bitstore-account-info panel panel-warning">
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
    else if (readyToUpload && fileDropState != "uploading" && bitstoreState != "checking file" && bitstoreState != "checking balance" && !uri) {

      var checkingExistingUri;
      if (this.state.checkingExistingUri) {
        checkingExistingUri = (
          <p className="alert alert-warning">
            Checking Existing URI...
          </p>
        )
      }

      var existingUriNotFound;
      if (this.state.existingUriError == "not found") {
        existingUriNotFound = (
          <p className="alert alert-danger">
            Existing URI Not Found! Please check to see that you pasted in the correct URI.
          </p>
        )
      }

      var existingUriSha1Mismatch;
      if (this.state.existingUriError == "sha1 mismatch") {
        existingUriSha1Mismatch = (
          <p className="alert alert-danger">
            Existing URI Does Not Match Scanned File! Please check to see that you pasted in the correct URI.
          </p>
        )
      }

      uploadFile = (
        <div className="upload-file">
          <p className="alert alert-warning">
            Pay a few cents in Bitcoin and upload your image to Bitstore.
          </p>
          <p>
            <label for="verify-bitstore-payment"><input type="checkbox" onChange={this.onVerifyBitstorePaymentToggle} ref="verifyBitstorePayment" name="verify-bitstore-payment" className="verify-bitstore-payment" /> I agree to the terms of service for Bitstore and to pay 300 bits for hosting and distribution costs.</label>
          </p>
          <button disabled={!this.state.verifiedBitstorePayment} className='btn btn-lg btn-warning btn-block upload-to-bitstore button' onClick={this.uploadToBitstore}>
            Upload To Bitstore
          </button>
          <div className="or">- Or - </div>
          <Input type='text' label='Existing URI' ref='existingUri' placeholder='Enter Image URI' bsStyle={this.existingUriValidationState()} onChange={this.onExistingUri} />
          {checkingExistingUri}
          {existingUriNotFound}
          {existingUriSha1Mismatch}
        </div>
      );
    };

    var bitstoreUploadProgress;
    if (fileDropState == "uploading") {
      bitstoreUploadProgress = (
        <div>
          <p className="alert alert-warning">
            Uploading file to Bitstore...
          </p>
          <div className="progress">
            <div className="progress-bar progress-bar-warning" style={{width: this.state.bitstoreUploadProgress + "%"}}></div>
          </div>
        </div>
      )
    }

    var bitstoreCheckingFile;
    if (bitstoreState == "checking file") {
      bitstoreCheckingFile = (
        <p className="alert alert-warning">
          Checking for existing file...
        </p>
      )
    }

    var bitstoreDepositingBitcoin;
    if ((this.state.isUpdatingBalance && this.state.bitstoreBalance === 0) || (this.state.didUpdateBalance && this.state.bitstoreBalance === 0)) {
      bitstoreDepositingBitcoin = (
        <p className="alert alert-warning">
          Waiting for Bitstore balance to update...
        </p>
      )
    }

    var bitstoreCheckingBalance;
    if (bitstoreState == "checking balance") {
      bitstoreCheckingBalance = (
        <p className="alert alert-warning">
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
            <label for="verify-register-payment"><input type="checkbox" onChange={this.onVerifyRegisterPaymentToggle} ref="verifyRegisterPayment" name="verify-register-payment" className="verify-register-payment"/> I agree to the terms of service and to be the rightful owner of this media and to pay 180 bits in Bitcoin network transaction fees.</label>
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
            {scanPrompt}
            {scanFile}
            {fileInformation}
          </div>
          <div className="col-sm-6">
            {bitstoreAccountInformation}
            {bitstoreDepositingBitcoin}
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
