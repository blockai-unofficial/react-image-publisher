var randombytes = require('randombytes');
var File = require("file-api").File;
var fs = require('fs');

var createRandomDropFileEvent = function(size, callback) {
  // TODO: create a random image and not just text
  var buffer = randombytes(size);
  var name = "random.txt";
  var path = __dirname + "/" + name;
  var file = new File({
    name: name,
    type: "text/plain",
    buffer: buffer
  });
  fs.writeFile(path, buffer, function(err) {
    var fakeEvt = {
      dataTransfer: {
        files: [ file ]
      }
    };
    callback(fakeEvt, file);
  });
};

module.exports = createRandomDropFileEvent;