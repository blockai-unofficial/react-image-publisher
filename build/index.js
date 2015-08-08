'use strict';

var React = require('react');
var openpublish = require('openpublish');
var bitstore = require('bitstore');
var shasum = require('shasum');
var bitcoinTxHexToJSON = require('bitcoin-tx-hex-to-json');

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
      balance: this.props.balance || 0,
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
      propagationStatus: '',
      openPublishReceipt: false,
      bitstoreUploadProgress: 0,
      fileScanProgress: 0,
      registerProgress: 0,
      isUpdatingBalance: false,
      registeringMessage: 'Initializing transactions...'
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
  componentDidMount: function componentDidMount() {
    var component = this;
    if (this.props.balance) {
      component.pollBitstoreBalance({
        retryAttempts: 100
      });
      return;
    }
    setInterval(function () {
      if (!component.state.balance) {
        component.updateBalance(function (err, balance) {
          if (balance > 0) {
            component.pollBitstoreBalance({
              retryAttempts: 100
            });
          }
        });
      }
    }, 3000);
  },
  onVerifyBitstorePaymentToggle: function onVerifyBitstorePaymentToggle(event) {
    this.setState({
      verifiedBitstorePayment: event.target.checked
    });
  },
  onVerifyRegisterPaymentToggle: function onVerifyRegisterPaymentToggle(event) {
    this.setState({
      verifiedRegisterPayment: event.target.checked
    });
  },
  checkIfUpdatingBitstoreBalance: function checkIfUpdatingBitstoreBalance(callback) {
    console.log('checkIfUpdatingBitstoreBalance');
    var component = this;
    var commonBlockchain = this.props.commonBlockchain;
    var commonWallet = this.props.commonWallet;
    var bitstoreDepositAddress = this.state.bitstoreDepositAddress;
    if (this.state.isUpdatingBalance) {
      return;
    }
    commonBlockchain.Addresses.Transactions([commonWallet.address], function (err, adrs_txs) {
      var txs = adrs_txs[0];
      var foundUpdatingTx;
      txs.forEach(function (tx) {
        var txDetails = bitcoinTxHexToJSON(tx.txHex);
        txDetails.vout.forEach(function (o) {
          var addr = o.scriptPubKey.addresses[0];
          if (addr == bitstoreDepositAddress) {
            foundUpdatingTx = true;
            console.log('setState', {
              didUpdateBalance: true,
              isUpdatingBalance: !(tx.blockHeight > 0)
            });
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
    });
  },
  updateBitstoreBalance: function updateBitstoreBalance(callback) {
    console.log('updateBitstoreBalance');
    var component = this;
    var bitstoreClient = this.state.bitstoreClient;
    bitstoreClient.wallet.get(function (err, res) {
      var bitstoreBalance = res.body.balance;
      var bitstoreDepositAddress = res.body.deposit_address;
      component.setState({
        bitstoreDepositAddress: bitstoreDepositAddress,
        bitstoreBalance: bitstoreBalance
      });
      if (callback) {
        callback(false, bitstoreBalance);
      }
      if (bitstoreBalance === 0) {
        component.checkIfUpdatingBitstoreBalance(); // we want to check to see if there are any unconfirmed transactions from the user to bitstoreDepositAddress
      }
    });
  },
  updateBalance: function updateBalance(callback) {
    console.log('updateBalance');
    var component = this;
    var commonWallet = this.props.commonWallet;
    var commonBlockchain = this.props.commonBlockchain;
    commonBlockchain.Addresses.Summary([commonWallet.address], function (err, adrs) {
      var balance = adrs && adrs[0] ? adrs[0].balance : 0;
      component.setState({
        balance: balance
      });
      if (callback) {
        callback(false, balance);
      }
    });
  },
  pollBitstoreBalance: function pollBitstoreBalance(options) {
    console.log('pollBitstoreBalance', options);
    var component = this;
    var retryAttempts = options.retryAttempts;
    this.updateBitstoreBalance(function (err, bitstoreBalance) {
      if (bitstoreBalance <= 0) {
        if (options.onRetry) {
          options.onRetry(retryAttempts);
        }
        return setTimeout(function () {
          if (retryAttempts > 0) {
            return component.pollBitstoreBalance({ retryAttempts: --retryAttempts });
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
  topUpBalance: function topUpBalance(options) {
    console.log('topUpBalance', options);
    var component = this;
    var commonWallet = this.props.commonWallet;
    var commonBlockchain = this.props.commonBlockchain;
    var value = 10000;
    var destinationAddress = this.state.bitstoreDepositAddress;
    component.setState({
      bitstoreState: 'waiting for confirmation',
      isUpdatingBalance: true
    });
    console.log('creating tx');
    commonWallet.createTransaction({
      destinationAddress: destinationAddress,
      value: value
    }, function (err, signedTxHex) {
      console.log('propagating tx', signedTxHex);
      commonBlockchain.Transactions.Propagate(signedTxHex, function (err, receipt) {
        if (err) {
          return;
        }
        var totalRetryAttempts = 25;
        component.pollBitstoreBalance({
          retryAttempts: totalRetryAttempts,
          onRetry: function onRetry(retriesRemaining) {
            var retryCount = totalRetryAttempts - retriesRemaining;
            console.log('still waiting for confirmation', retryCount + '/' + totalRetryAttempts);
            component.setState({
              bitstoreState: 'still waiting for confirmation'
            });
          },
          onConfirmation: function onConfirmation() {
            console.log('confirmed balance updated');
            component.setState({
              bitstoreState: 'confirmed',
              fileDropState: 'scanned',
              isUpdatingBalance: false
            });
            if (options.onConfirmation) {
              options.onConfirmation();
            }
          },
          onNoConfirmation: function onNoConfirmation() {
            console.log('giving up balance update');
            component.setState({
              bitstoreState: 'done waiting for confirmation'
            });
            if (options.onNoConfirmation) {
              options.onNoConfirmation();
            }
          }
        });
      });
    });
  },
  getPayloadsLength: function getPayloadsLength(options) {
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
    }, function (err, payloadsLength) {
      component.setState({
        payloadsLength: payloadsLength
      });
    });
  },
  onBuildProgress: function onBuildProgress(e) {
    // the first half of the registration process is building the transactions...
    this.setState({
      registeringMessage: 'Building and Signing transactions...',
      registerProgress: Math.round(e.count / (e.payloadsLength * 2) * 100) // range: 0% to 50%
    });
  },
  onPropagateProgress: function onPropagateProgress(e) {
    // the second half of the registration process is propagating the transactions...
    this.setState({
      registeringMessage: 'Propagating transactions...',
      registerProgress: Math.round((e.transactionTotal + e.count) / (e.transactionTotal * 2) * 100) // range: 50% to 100%
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
      commonBlockchain: commonBlockchain,
      propagationStatus: component.onPropagateProgress,
      buildStatus: component.onBuildProgress
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
  onBitstoreUploadProgress: function onBitstoreUploadProgress(e) {
    if (!e.percent) {
      return;
    }
    this.setState({
      bitstoreUploadProgress: parseInt(e.percent)
    });
  },
  readyToUpload: function readyToUpload() {
    if (this.state.isUpdatingBalance && this.state.bitstoreBalance === 0 || this.state.didUpdateBalance && this.state.bitstoreBalance === 0) {
      return false;
    }
    return this.state.fileInfo && this.state.fileInfo.file && this.state.fileSha1;
  },
  uploadToBitstore: function uploadToBitstore() {
    var startTime = +new Date();
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
        onConfirmation: function onConfirmation() {
          component.uploadToBitstore();
        }
      });
      return;
    }
    if (!this.readyToUpload()) {
      return;
    }
    this.setState({
      bitstoreState: 'checking file'
    });
    bitstoreClient.files.meta(fileSha1, function (err, res) {
      var bitstoreMeta = res.body;
      if (bitstoreMeta.size) {
        // needs a more robust check
        component.setState({
          bitstoreState: '',
          bitstoreStatus: 'existing',
          bitstoreMeta: bitstoreMeta,
          fileDropState: 'uploaded'
        });
        return;
      }
      component.setState({
        bitstoreState: 'checking balance'
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
            bitstoreState: 'no balance'
          });
          return;
        }
        component.setState({
          bitstoreClient: bitstoreClient,
          fileDropState: 'uploading',
          bitstoreState: 'has balance'
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
          component.getPayloadsLength({ bitstoreMeta: bitstoreMeta, fileInfo: fileInfo, fileSha1: fileSha1 });
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
    if (!component.props.disableProgress) {
      reader.addEventListener('progress', function (e) {
        if (e.lengthComputable) {
          var percent = Math.round(e.loaded / e.total * 100);
          component.setState({
            fileScanProgress: percent
          });
        }
      });
    }
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
    if (this.state.balance === 0 && this.props.balance === 0 && this.props.NoBalance) {
      var NoBalance = this.props.NoBalance;
      return React.createElement(NoBalance, { address: this.props.commonWallet.address, intentMessage: 'to register an image with Open Publish' });
    }
    var fileDropState = this.state.fileDropState;
    var imgPreview = this.state.imgPreviewDataURL ? React.createElement('img', { className: 'image-preview', src: this.state.imgPreviewDataURL }) : false;
    var bitstoreMeta = this.state.bitstoreMeta;
    var bitstoreState = this.state.bitstoreState;
    var bitstoreBalance = this.state.bitstoreBalance;
    var bitstoreDepositAddress = this.state.bitstoreDepositAddress;
    var commonWallet = this.props.commonWallet || { address: '' };

    var fileName = this.state.fileInfo ? this.state.fileInfo.file.name : '';
    var fileType = this.state.fileInfo ? this.state.fileInfo.file.type : '';
    var fileSize = this.state.fileInfo ? this.state.fileInfo.file.size : '';
    var fileSha1 = this.state.fileSha1;
    var displayUri = bitstoreMeta.uri ? bitstoreMeta.uri.split('//')[1].split('/')[0] + '/.../' + fileSha1.slice(0, 3) + '...' + fileSha1.slice(-3, 40) : '';

    var readyToScan = true;
    var readyToRegister = this.readyToRegister();
    var readyToUpload = this.readyToUpload();

    var noBalance = bitstoreState == 'no balance';

    var scanFile;
    if (readyToScan && !this.state.fileInfo) {
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
          ),
          fileDropState == 'scanning' ? React.createElement(
            'h4',
            null,
            'Scanning File'
          ) : false
        ),
        imgPreview
      );
    }

    var fileInformation, scanPrompt;
    if (this.state.fileInfo && fileSha1) {
      fileInformation = React.createElement(
        'div',
        { className: 'file-info panel panel-default' },
        React.createElement('div', { className: 'file-drop-state' }),
        React.createElement(
          'div',
          { className: 'panel-body' },
          imgPreview
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
          ),
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
    } else {
      scanPrompt = React.createElement(
        'p',
        { className: 'alert alert-info' },
        'Drag and drop an image on the area below to get started.'
      );
    }

    var bitstoreAccountInformation;
    if (bitstoreDepositAddress) {
      bitstoreAccountInformation = React.createElement(
        'div',
        { className: 'bitstore-account-info panel panel-warning' },
        React.createElement(
          'div',
          { className: 'panel-heading' },
          'Bitstore Account Information'
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
              'Balance'
            ),
            React.createElement(
              'td',
              null,
              bitstoreBalance
            )
          ),
          React.createElement(
            'tr',
            null,
            React.createElement(
              'th',
              null,
              'Deposit Address'
            ),
            React.createElement(
              'td',
              null,
              bitstoreDepositAddress
            )
          )
        )
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
          'Bitstore File Information'
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
    } else if (readyToUpload && fileDropState != 'uploading' && bitstoreState != 'checking file' && bitstoreState != 'checking balance') {
      uploadFile = React.createElement(
        'div',
        { className: 'upload-file' },
        React.createElement(
          'p',
          { className: 'alert alert-warning' },
          'Pay a few cents in Bitcoin and upload your image to Bitstore.'
        ),
        React.createElement(
          'p',
          null,
          React.createElement(
            'label',
            { 'for': 'verify-bitstore-payment' },
            React.createElement('input', { type: 'checkbox', onChange: this.onVerifyBitstorePaymentToggle, ref: 'verifyBitstorePayment', name: 'verify-bitstore-payment', className: 'verify-bitstore-payment' }),
            ' I agree to the terms of service for Bitstore and to pay 100 bits for hosting and distribution costs.'
          )
        ),
        React.createElement(
          'button',
          { disabled: !this.state.verifiedBitstorePayment, className: 'btn btn-lg btn-warning btn-block upload-to-bitstore button', onClick: this.uploadToBitstore },
          'Upload To Bitstore'
        )
      );
    };

    var bitstoreUploadProgress;
    if (fileDropState == 'uploading') {
      bitstoreUploadProgress = React.createElement(
        'div',
        null,
        React.createElement(
          'p',
          { className: 'alert alert-warning' },
          'Uploading file to Bitstore...'
        ),
        React.createElement(
          'div',
          { className: 'progress' },
          React.createElement('div', { className: 'progress-bar progress-bar-warning', style: { width: this.state.bitstoreUploadProgress + '%' } })
        )
      );
    }

    var bitstoreCheckingFile;
    if (bitstoreState == 'checking file') {
      bitstoreCheckingFile = React.createElement(
        'p',
        { className: 'alert alert-warning' },
        'Checking for existing file...'
      );
    }

    var bitstoreDepositingBitcoin;
    if (this.state.isUpdatingBalance || this.state.didUpdateBalance && this.state.bitstoreBalance === 0) {
      bitstoreDepositingBitcoin = React.createElement(
        'p',
        { className: 'alert alert-warning' },
        'Waiting for Bitstore balance to update...'
      );
    }

    var bitstoreCheckingBalance;
    if (bitstoreState == 'checking balance') {
      bitstoreCheckingBalance = React.createElement(
        'p',
        { className: 'alert alert-warning' },
        'Checking Bitstore balance...'
      );
    }

    var registerFile;
    if (readyToRegister && fileDropState != 'registering' && fileDropState != 'registered') {
      registerFile = React.createElement(
        'div',
        { className: 'register-file' },
        React.createElement(
          'p',
          { className: 'alert alert-info' },
          'You are now ready to register your image with Open Publish.'
        ),
        React.createElement(
          'p',
          null,
          React.createElement(
            'label',
            { 'for': 'verify-register-payment' },
            React.createElement('input', { type: 'checkbox', onChange: this.onVerifyRegisterPaymentToggle, ref: 'verifyRegisterPayment', name: 'verify-register-payment', className: 'verify-register-payment' }),
            ' I agree to be the rightful owner of this media and to pay 60 bits in Bitcoin network transaction fees.'
          )
        ),
        React.createElement(
          'button',
          { disabled: !this.state.verifiedRegisterPayment, className: 'btn btn-lg btn-primary btn-block register-with-openpublish', onClick: this.registerWithOpenPublish },
          'Register Image'
        )
      );
    }

    var registerProgress;
    if (fileDropState == 'registering') {
      registerProgress = React.createElement(
        'div',
        null,
        React.createElement(
          'p',
          { className: 'alert alert-info' },
          this.state.registeringMessage
        ),
        React.createElement(
          'div',
          { className: 'progress' },
          React.createElement('div', { className: 'progress-bar', style: { width: this.state.registerProgress + '%' } })
        )
      );
    }

    var openPublishReceipt = this.state.openPublishReceipt;
    var openPublishReceiptView;
    if (openPublishReceipt) {
      var txid = openPublishReceipt.blockcastTx.txid;
      var displayTxid = txid.slice(0, 12) + '...' + txid.slice(-12, 64);
      var transactionTotal = openPublishReceipt.blockcastTx.transactionTotal;
      var blocktrailLink = React.createElement(
        'a',
        { href: 'https://www.blocktrail.com/tBTC/tx/' + txid },
        'Blocktrail'
      );
      openPublishReceiptView = React.createElement(
        'div',
        null,
        React.createElement(
          'p',
          { className: 'alert alert-success open-publish-receipt' },
          'The transaction that represents your Open Publish registration is propagating and waiting for confirmation.'
        ),
        React.createElement(
          'div',
          { className: 'registration-info panel panel-default' },
          React.createElement(
            'div',
            { className: 'panel-heading' },
            'Registration Information'
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
                'txid'
              ),
              React.createElement(
                'td',
                null,
                displayTxid
              )
            ),
            React.createElement(
              'tr',
              null,
              React.createElement(
                'th',
                null,
                'Transaction count'
              ),
              React.createElement(
                'td',
                null,
                transactionTotal
              )
            ),
            React.createElement(
              'tr',
              null,
              React.createElement(
                'th',
                null,
                'Transaction info'
              ),
              React.createElement(
                'td',
                null,
                blocktrailLink
              )
            )
          )
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
      React.createElement(
        'div',
        { className: 'row' },
        React.createElement(
          'div',
          { className: 'col-sm-6' },
          scanPrompt,
          scanFile,
          fileInformation
        ),
        React.createElement(
          'div',
          { className: 'col-sm-6' },
          bitstoreAccountInformation,
          bitstoreDepositingBitcoin,
          bitstoreCheckingFile,
          bitstoreCheckingBalance,
          bitstoreUploadProgress,
          uploadFile,
          registerFile,
          registerProgress,
          openPublishReceiptView
        )
      )
    );
  }
});

module.exports = ImagePublisher;