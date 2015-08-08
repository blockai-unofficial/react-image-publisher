var React = require('react');
var ImagePublisher = require('../src');
var NoBalance = require('./no-balance');

var commonBlockchain = require('blockcypher-unofficial')({
  network: "testnet",
  inBrowser: true
});

var faucet = require('common-faucet');
var faucetClient = faucet({
  network: "testnet",
  commonBlockchain: commonBlockchain,
  inBrowser: true
});

var seed = 'test';
if (window.location.search.split("?seed=") && window.location.search.split("?seed=")[1]) {
  seed = window.location.search.split("?seed=")[1];
}

var testCommonWallet = require('test-common-wallet');
var commonWallet = testCommonWallet({
  seed: seed,
  network: "testnet",
  commonBlockchain: commonBlockchain
});

// faucetClient.Get({
//   faucetURL: "http://blockai-faucet.herokuapp.com/",
//   address: commonWallet.address
// }, function(err, receipt) {
//   console.log(err, receipt);
// });

commonBlockchain.Addresses.Summary([commonWallet.address], function(err, adrs) { 
  var balance = adrs && adrs[0] ? adrs[0].balance : 0;
  React.render(
    React.createElement(ImagePublisher, { balance: balance, NoBalance: NoBalance, commonBlockchain: commonBlockchain, commonWallet: commonWallet}),
    document.getElementById('example')
  );
});

