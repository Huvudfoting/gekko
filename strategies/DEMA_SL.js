// helpers
var _ = require('lodash');
var log = require('../core/log.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function () {
  this.name = 'DEMA_SL'; //DEMA WITH STOP-LOSS
  this.age = 0;
  this.prefix = '$';
  this.sl = this.getSLState(this.settings.stoploss);
  this.boughtIn = false;
  this.hasTraded = false;
  this.currentTrend;
  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('dema', 'DEMA', this.settings);
  this.addIndicator('sma', 'SMA', this.settings.weight);
}

// what happens on every new candle?
method.update = function (candle) {
  //Calculate stop loss state
  this.age++;
  let sl = this.sl;
  if (sl.boughtCandle != null) {
    sl.inCurrency = candle.close - sl.boughtCandle.close;
    sl.inPercent = sl.inCurrency / sl.boughtCandle.close;
    sl.activate = (sl.inPercent < 0) && (sl.inPercent + sl.allowed > 0);
  }
}

method.check = function (candle) {
  let dema = this.indicators.dema;
  let sma = this.indicators.sma;
  let resDEMA = dema.result;
  let resSMA = sma.result;
  let price = candle.close;
  let diff = resSMA - resDEMA;

  let message = '@ ' + price.toFixed(5) + ' (' + resDEMA.toFixed(5) + '/' + diff.toFixed(5) + ')';

  //Check stop-loss and sell if needed
  if (this.sl.activate) {
    log.warn(this.prefix, 'STOP-LOSS!', message);
    this.advice('short');
    this.sl = this.getSLState(this.settings.stoploss);
    this.setTradeState(false);
    return;
  }

  if (diff > this.settings.thresholds.up) {
    log.debug('we are currently in uptrend', message);

    if (this.currentTrend !== 'up') {
      this.currentTrend = 'up';
      //BUY and set stop-loss and trade state
      this.advice('long');
      this.sl.boughtCandle = candle;
      this.setTradeState(true);
    } else
      this.advice();

  } else if (diff < this.settings.thresholds.down) {
    log.debug('we are currently in a downtrend', message);

    if (this.currentTrend !== 'down') {
      this.currentTrend = 'down';
      //SELL and reset stop-loss and trade state
      this.advice('short');
      this.sl = this.getSLState(this.settings.stoploss);
      this.setTradeState(false);
    } else
      this.advice();

  } else {
    log.info(this.prefix, 'NO TREND', message);
    this.advice();
  }
}

//Keep state to calculate stop loss
method.getSLState = function (slPercent) {
  return {
    allowed: slPercent,
    boughtCandle: null,
    inCurrency: 0,
    inPercent: 0,
    activate: false
  }
}

method.setTradeState = function (buy) {
  this.boughtIn = buy;
  this.hasTraded = true;
}

// for debugging purposes: log the last calculated
// EMAs and diff.
method.log = function () {
  var dema = this.indicators.dema;
  let sma = this.indicators.sma;
  let sl = this.sl;
  let sSL = 'SL: ' + sl.inPercent.toFixed(1) + ' (of ' + sl.allowed + ')';
  let sDiff = '(' + (sma.result - dema.result).toFixed(5) + ')';
  let inMarket = '[UNDECIDED]';
  if (this.hasTraded) {
    inMarket = (this.boughtIn) ? '[IN]' : '[OUT]';
  }
  log.info(this.prefix, '----- Candle', dema.inner.age, '-----');
  log.info(this.prefix, 'IN:', inMarket, sSL);
  log.info(this.prefix, 'DEMA:', dema.result.toFixed(5), '(I:', dema.inner.result.toFixed(5), 'O:', dema.outer.result.toFixed(5), ')');
  log.info(this.prefix, 'SMA:', sma.result.toFixed(5), 'DIFF:', sDiff);
  log.info(this.prefix, '--- End Candle', dema.inner.age, '---');
}

module.exports = method;
