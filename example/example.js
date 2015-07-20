var React = require('react');
var bitcoin = require('bitcoinjs-lib');
var randombytes = require('randombytes');
var ImagePublisher = require('../src');
var commonBlockchain = require('blockcypher-unofficial')({
  network: "testnet",
  inBrowser: true
});

var simpleCommonWallet = function(options) {

  var seed, commonBlockchain;

  commonBlockchain = options.commonBlockchain;

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

  var createTransaction = function(options, callback) {
    var value = options.value;
    var destinationAddress = options.destinationAddress;
    commonBlockchain.Addresses.Unspents([destinationAddress], function(err, addressesUnspents) {
      var unspentOutputs = addressesUnspents[0];
      unspentOutputs.forEach(function(utxo) {
        utxo.txHash = utxo.txid;
        utxo.index = utxo.vout;
      });
      wallet.setUnspentOutputs(unspentOutputs);
      var newTx = wallet.createTx(destinationAddress, value, 1000, address);
      var signedTx = wallet.signWith(newTx, [address]);
      var signedTxHex = signedTx.toHex();
      callback(err, signedTxHex);
    });

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

var commonWallet = simpleCommonWallet({
  seed: "test",
  commonBlockchain: commonBlockchain
});

React.render(
  React.createElement(ImagePublisher, { commonBlockchain: commonBlockchain, commonWallet: commonWallet}),
  document.getElementById('example')
);
