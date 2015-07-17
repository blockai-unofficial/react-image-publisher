var React = require('react');

var GuideText = React.createClass({
  displayName: 'GuideText',
  render: function () {
    var fileDropState = this.props.fileDropState;
    return (
      <div className='guide section'>
        <div className='guide-state-none' style={{display: !fileDropState ? '' : 'none'}}>
          <p>Welcome to the Bitstore Image Publisher.  To get started simply drag and drop a file into the highlighed area.</p>
          <p className="guide-note">Note: You must have XX amount of Bitstore credit to upload a file to Bitstore.</p>
        </div>

        <div className='guide-state-scanned' style={{display: fileDropState === "scanned" ? '' : 'none'}}>
          <p>Great job!  Your file has been scanned and is now ready to be uploaded to Bitstore.</p>
        </div>

        <div className='guide-state-uploaded' style={{display: fileDropState === "uploaded" ? '' : 'none'}}>
          <p>Awesome work!  Your file has been uploaded to Bitstore and is now ready to be published to <a href='https://github.com/blockai/openpublish/' target='_blank'>OpenPublish</a>.</p>
        </div>

        <div className='guide-state-registered' style={{display: fileDropState === "registered" ? '' : 'none'}}>
          <p>Your file has been published on <a href='https://github.com/blockai/openpublish/' target='_blank'>OpenPublish</a> and is now ready to use!</p>
        </div>
      </div>
    )
  }
});

module.exports = GuideText
