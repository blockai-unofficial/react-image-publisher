var React = require('react');

var Preview = React.createClass({
  displayName: 'Preview',
  render: function () {
    var fileDropState = this.props.fileDropState;
    var imgPreview = this.props.filePreview;
    return (
      <div className='preview section' style={{display: fileDropState === "scanned" || fileDropState === "uploaded" ? '' : 'none'}}>
        <h3 className='title'>File Preview</h3>
        {imgPreview}
      </div>
    )
  }
});

module.exports = Preview
