// DANRO custom indicator
// required indicators
var EMA = require('./EMA.js');

var Indicator = function(settingsObj) {
  this.input = 'price';
  this.short = new EMA(settingsObj.short);
  this.long = new EMA(settingsObj.long);

  //state
  this.state = null;
}

// add a price and calculate the EMAs and
// the diff for that price
Indicator.prototype.update = function(price) {
  //Calculate outputs and save state
  this.short.update(price);
  this.long.update(price);
  this.state = this.getState(price, this.state);
}

Indicator.prototype.getState = function(price, lastState) {
    
    let newState =  {
        //Price and EMAs
        price: price,
        short: this.short.result,
        long: this.long.result,
        age: this.short.age,
    };

    return newState;
}

module.exports = Indicator;
