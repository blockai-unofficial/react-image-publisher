'use strict';

var React = require('react');

var GuideText = React.createClass({
  displayName: 'GuideText',
  render: function render() {
    var fileDropState = this.props.fileDropState;
    return React.createElement(
      'div',
      { className: 'guide section' },
      React.createElement(
        'div',
        { className: 'guide-state-none', style: { display: !fileDropState ? '' : 'none' } },
        React.createElement(
          'p',
          null,
          'Welcome to the Bitstore Image Publisher.  To get started simply drag and drop a file into the highlighed area.'
        ),
        React.createElement(
          'p',
          { className: 'guide-note' },
          'Note: You must have XX amount of Bitstore credit to upload a file to Bitstore.'
        )
      ),
      React.createElement(
        'div',
        { className: 'guide-state-scanned', style: { display: fileDropState === 'scanned' ? '' : 'none' } },
        React.createElement(
          'p',
          null,
          'Great job!  Your file has been scanned and is now ready to be uploaded to Bitstore.'
        )
      ),
      React.createElement(
        'div',
        { className: 'guide-state-uploaded', style: { display: fileDropState === 'uploaded' ? '' : 'none' } },
        React.createElement(
          'p',
          null,
          'Awesome work!  Your file has been uploaded to Bitstore and is now ready to be published to ',
          React.createElement(
            'a',
            { href: 'https://github.com/blockai/openpublish/', target: '_blank' },
            'OpenPublish'
          ),
          '.'
        )
      ),
      React.createElement(
        'div',
        { className: 'guide-state-registered', style: { display: fileDropState === 'registered' ? '' : 'none' } },
        React.createElement(
          'p',
          null,
          'Your file has been published on ',
          React.createElement(
            'a',
            { href: 'https://github.com/blockai/openpublish/', target: '_blank' },
            'OpenPublish'
          ),
          ' and is now ready to use!'
        )
      )
    );
  }
});

module.exports = GuideText;