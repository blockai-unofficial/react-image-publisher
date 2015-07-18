var React = require('react');

var Embed = React.createClass({
  displayName: 'Embed',
  render: function () {
    var fileDropState = this.props.fileDropState;
    return (
      <div className='embed section' style={{display: fileDropState === "registered" ? '' : 'none'}}>
        <h3 className='title'>Embed File</h3>
        <div className='embed-component'>
          embed component will go here
        </div>
      </div>
    )
  }
});

module.exports = Embed
