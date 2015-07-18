'use strict';

var React = require('react');

var Preview = React.createClass({
  displayName: 'Preview',
  render: function render() {
    var fileDropState = this.props.fileDropState;
    var imgPreview = this.props.filePreview;
    return React.createElement(
      'div',
      { className: 'preview section', style: { display: fileDropState === 'scanned' || fileDropState === 'uploaded' ? '' : 'none' } },
      React.createElement(
        'h3',
        { className: 'title' },
        'File Preview'
      ),
      imgPreview
    );
  }
});

module.exports = Preview;