"use strict";

var request = require("request");

var OpenpublishState = function OpenpublishState(baseOptions) {

  var findRegistration = function findRegistration(options, callback) {

    var sha1 = options.sha1;

    request("http://testnet.d.blockai.com/opendocs/sha1/" + sha1, function (err, res, body) {
      callback(err, body);
    });
  };

  return {
    findRegistration: findRegistration
  };
};

module.exports = OpenpublishState;