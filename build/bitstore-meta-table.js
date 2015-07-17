'use strict';

var React = require('react');

var BitstoreMetaTable = React.createClass({
  displayName: 'BitstoreMetaTable',
  render: function render() {
    var fileDropState = this.props.fileDropState;
    var bitstoreMeta = this.props.bitstoreMeta;
    return React.createElement(
      'div',
      { className: 'info section', style: { display: bitstoreMeta && fileDropState === 'uploaded' ? 'block' : 'none' } },
      React.createElement(
        'h3',
        { className: 'title' },
        'File Info'
      ),
      React.createElement(
        'ul',
        { className: 'info-table' },
        React.createElement(
          'li',
          null,
          React.createElement(
            'div',
            { className: 'info-table-title' },
            'Type'
          ),
          React.createElement(
            'div',
            { className: 'info-table-result' },
            bitstoreMeta.mimetype
          )
        ),
        React.createElement(
          'li',
          null,
          React.createElement(
            'div',
            { className: 'info-table-title' },
            'Size'
          ),
          React.createElement(
            'div',
            { className: 'info-table-result' },
            bitstoreMeta.size
          )
        ),
        React.createElement(
          'li',
          null,
          React.createElement(
            'div',
            { className: 'info-table-title' },
            'Downloads'
          ),
          React.createElement(
            'div',
            { className: 'info-table-result' },
            bitstoreMeta.downloads
          )
        ),
        React.createElement(
          'li',
          null,
          React.createElement(
            'div',
            { className: 'info-table-title' },
            'Web URL'
          ),
          React.createElement(
            'div',
            { className: 'info-table-result' },
            ' ',
            React.createElement(
              'a',
              { href: bitstoreMeta.uri, target: '_blank' },
              bitstoreMeta.uri
            ),
            ' '
          )
        ),
        React.createElement(
          'li',
          null,
          React.createElement(
            'div',
            { className: 'info-table-title' },
            'Torrent URL'
          ),
          React.createElement(
            'div',
            { className: 'info-table-result' },
            React.createElement(
              'a',
              { href: bitstoreMeta.torrent, target: '_blank' },
              bitstoreMeta.torrent
            )
          )
        )
      )
    );
  }
});

module.exports = BitstoreMetaTable;