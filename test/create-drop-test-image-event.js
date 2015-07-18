var File = require("file-api").File;
var fs = require('fs');

var createDropTestImageEvent = function(callback) {
  fs.readFile(__dirname + '/test.gif', function (err, fileData) {
    // at some point we could generate a random image so we don't have conflicts in bitstore
    var fileBuffer = fileData;
    var fileName = "test.gif";
    var fileType = "image/gif";
    var file = new File({ 
      name: fileName,
      type: fileType,
      buffer: fileBuffer
    });

    var files = [
      file
    ];

    var fakeEvt = {
      dataTransfer: {
        files: files
      }
    };
    callback(fakeEvt, file);
  });
}

module.exports = createDropTestImageEvent;