var React = require('react');

var BitstoreMetaTable = React.createClass({
  displayName: 'BitstoreMetaTable',
  render: function () {
    var fileDropState = this.props.fileDropState;
    var bitstoreMeta = this.props.bitstoreMeta;
    return (
      <div className='info section' style={{display: bitstoreMeta && fileDropState === "uploaded" ? 'block' : 'none'}}>
        <h3 className='title'>File Info</h3>
        <ul className='info-table'>
          <li>
            <div className='info-table-title'>Type</div>
            <div className='info-table-result'>{bitstoreMeta.mimetype}</div>
          </li>
          <li>
            <div className='info-table-title'>Size</div>
            <div className='info-table-result'>{bitstoreMeta.size}</div>
          </li>
          <li>
            <div className='info-table-title'>Downloads</div>
            <div className='info-table-result'>{bitstoreMeta.downloads}</div>
          </li>
          <li>
            <div className='info-table-title'>Web URL</div>
            <div className='info-table-result'> <a href={bitstoreMeta.uri} target='_blank'>{bitstoreMeta.uri}</a> </div>
          </li>
          <li>
            <div className='info-table-title'>Torrent URL</div>
            <div className='info-table-result'><a href={bitstoreMeta.torrent} target='_blank'>{bitstoreMeta.torrent}</a></div>
          </li>
        </ul>
      </div>
    )
  }
});

module.exports = BitstoreMetaTable;