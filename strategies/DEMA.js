// helpers
var _ = require('lodash');
var log = require('../core/log.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function () {
  this.name = 'DEMA';

  this.currentTrend;
  this.requiredHistory = this.tradingAdvisor.historySize;
  this.countdown = this.requiredHistory;
  // define the indicators we need
  this.addIndicator('dema', 'DEMA', this.settings);
}

// what happens on every new candle?
method.update = function (candle) {
  if (this.countdown > 0) {
    this.countdown--
      log.info('#', 'Countdown:', this.countdown, 'candles')
  }
}

// for debugging purposes: log the last calculated
// EMAs and diff.
method.log = function () {
  var dema = this.indicators.dema;

  log.info('#', 'Calculated DEMA properties for candle:');
  log.info('#', 'EMA', 'S:', dema.short.result.toFixed(2), 'L:', dema.long.result.toFixed(2), 'D:', dema.result.toFixed(2));
  log.info('#', 'Age:', dema.short.age, 'candles');
}

method.check = function (candle) {
  var dema = this.indicators.dema;
  var diff = dema.result;
  var price = candle.close;

  var message = '@ ' + price.toFixed(8) + ' (' + diff.toFixed(5) + ')';

  if (diff > this.settings.thresholds.up) {
    log.info('#', 'UPTREND', message);

    if (this.currentTrend !== 'up') {
      this.currentTrend = 'up';
      this.advice('long');
    } else
      this.advice();

  } else if (diff < this.settings.thresholds.down) {
    log.info('#', 'DOWNTREND', message);

    if (this.currentTrend !== 'down') {
      this.currentTrend = 'down';
      this.advice('short');
    } else
      this.advice();

  } else {
    log.info('#', 'NO TREND', message);
    this.advice();
  }
}

module.exports = method;
