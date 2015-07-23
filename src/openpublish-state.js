var request = require("request");

var OpenpublishState = function(baseOptions) {

  var findRegistration = function(options, callback) {

    var sha1 = options.sha1;

    request("http://testnet.d.blockai.com/opendocs/sha1/" + sha1, function(err, res, body) {
      callback(err, body);
    });

  }

  return {
    findRegistration: findRegistration
  }

};

module.exports = OpenpublishState;