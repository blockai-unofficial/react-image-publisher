'use strict';

var React = require('react');

var Embed = React.createClass({
  displayName: 'Embed',
  render: function render() {
    var fileDropState = this.props.fileDropState;
    return React.createElement(
      'div',
      { className: 'embed section', style: { display: fileDropState === 'registered' ? '' : 'none' } },
      React.createElement(
        'h3',
        { className: 'title' },
        'Embed File'
      ),
      React.createElement(
        'div',
        { className: 'embed-component' },
        'embed component will go here'
      )
    );
  }
});

module.exports = Embed;