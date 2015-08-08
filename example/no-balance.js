var React = require('react');
var NoBalance = React.createClass({
  render: function() {
    var address = this.props.address;
    var intentMessage = this.props.intentMessage;
    var tweetUrlBase = 'https://twitter.com/intent/tweet';
    tweetUrlBase += '?text=' + encodeURIComponent("My wallet, " + address + ", needs some funds " + intentMessage + "!");
    tweetUrlBase += '&hashtags=needbitcoin';
    //tweetUrlBase += '&url=' + encodeURIComponent('https://www.blockai.com/address/' + address);
    return (
      <div className="no-balance">
        <h4>Uh oh, you don't have any Bitcoin!</h4>
        <p>
          If you'd like {intentMessage} you're going need to get some Bitcoin.
        </p>  
        <p> 
          If you or someone you know does have Bitcoin, send some to this address: <a href={"bitcoin:" + address}>{address}</a>
        </p>
        <p>
          If not, don't worry, there's a lot of people ready to give out a few cents worth to get new people involved!
        </p>
        <p>
          Sometimes <strong>it can take a few minutes</strong> for the Bitcoin network to register a transaciton and update your balance. Please be patient!
        </p>
        <p>
          <a href={tweetUrlBase} className="btn btn-primary">Ask on Twitter for Bitcoin</a> 
        </p>
      </div>
    );
  }
});
module.exports = NoBalance;