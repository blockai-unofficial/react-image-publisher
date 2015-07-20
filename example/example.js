var React = require('react');
var bitcoin = require('bitcoinjs-lib');
var randombytes = require('randombytes');
var ImagePublisher = require('../src');
var commonBlockchain = require('blockcypher-unofficial')({
  network: "testnet",
  inBrowser: true
});

var testCommonWallet = require('test-common-wallet');

var commonWallet = testCommonWallet({
  seed: "test",
  network: "testnet",
  commonBlockchain: commonBlockchain
});

React.render(
  React.createElement(ImagePublisher, { commonBlockchain: commonBlockchain, commonWallet: commonWallet}),
  document.getElementById('example')
);
