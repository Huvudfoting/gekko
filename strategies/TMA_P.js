var _ = require('lodash');
var log = require('../core/log.js');

var method = {};

method.init = function () {
  this.name = 'TMA (Preset)';
  this.requiredHistory = 0; //0 if we sucessfully load history from file. 
  this.indicatorHistoryFile = 'logs/TMA_P-history.txt'
  //this.age = 0;
  this.current = null;

  //Attempt to read settings with previously saved indicator history from file
  //Makes it easy to skip the (significant) warmup period of this strategy
  let success = this.settingsFromHistoryFile();

  this.addIndicator('short', 'SMA', this.settings.short)
  this.addIndicator('medium', 'SMA', this.settings.medium)
  this.addIndicator('long', 'SMA', this.settings.long)

  if(success) {
    log.info('#', 'Preloading SMAs from config');
    this.preloadEma(this.indicators.short, this.settings.preload);
    this.preloadEma(this.indicators.medium, this.settings.preload);
    this.preloadEma(this.indicators.long, this.settings.preload);
  }
}

method.update = function (candle) {
  this.current = candle;
  // THE BUG BY UPDATING THESE HERE SO THEY UPDATE TWICE INCREASES PROFITS IN MY TESTS (!!!)
  this.indicators.short.update(candle.close);
  this.indicators.medium.update(candle.close);
  this.indicators.long.update(candle.close);
}

method.check = function () {
  const short = this.indicators.short.result;
  const medium = this.indicators.medium.result;
  const long = this.indicators.long.result;

  if ((short > medium) && (medium > long)) {
    log.info('#', this.age, 'GO LONG! (S > M and M > L)');
    this.advice('long')
  } else if ((short < medium) && (medium > long)) {
    log.info('#', this.age, 'GO SHORT! (S < M and M > L)');
    this.advice('short')
  } else if (((short > medium) && (medium < long))) {
    log.info('#', this.age, 'GO SHORT! (S > M and M < L)');
    this.advice('short')
  } else {
    log.info('#', this.age, 'UNDECIDED');
    this.advice();
  }
}

// for debugging purposes: log the last calculated
// EMAs and diff.
method.log = function () {
  let s = this.indicators.short;
  let m = this.indicators.medium;
  let l = this.indicators.long;

  log.info('# P:', this.current.close.toFixed(2), 'S:', s.result.toFixed(2), 'M:', m.result.toFixed(2), 'L:', l.result.toFixed(2));
  /*
  log.info('#', 'Age:', this.age, 'candles');
  log.debug('#', 'short =', this.priceArr2str(s.prices, this.settings.short));
  log.debug('#', 'medium =', this.priceArr2str(m.prices, this.settings.length));
  log.debug('#', 'long =', this.priceArr2str(l.prices, this.settings.long));
  */

  //Save indicator history to file 
  this.saveIndicatorHistory();
}

//Preload EMAs
method.preloadEma = function (sma, vals) {
  //Set age if needed
  if(vals.length < this.age) this.age = vals.length;

  if (vals != null && vals.length > 0) {
    //Preload arrays and internal SMA indicator price arrays ordered newest to oldest.
    let cVals = _.clone(vals)
    for (var i = 0; i < cVals.length; i++) {
      sma.update(cVals[i]);
    }
    log.info('#', 'Preloaded:', this.priceArr2str(sma.prices, 0, sma.prices.length));
    return;
  }
  log.warn('#', 'Could not preload');
}

//Write to file
method.saveIndicatorHistory = function () {
  const fs = require('fs');
  let o = this.getSettingsWithIndicatorHistory();

  fs.writeFile(this.indicatorHistoryFile, JSON.stringify(o, null, 1), (err) => {
    // log error
    if (err) {
      log.warn('# Failed to save history', err)
    } else {
      // success 
      log.debug('# History saved');
    }
  });
}

//Attempt to read settings with previously saved indicator history from file
method.settingsFromHistoryFile = function () {
  const fs = require('fs');
  var readHistory = JSON.parse(fs.readFileSync(this.indicatorHistoryFile, 'utf8'));

  if (readHistory.short > 0) {
    //success
    this.settings = readHistory;
    log.info("Sucessfully read history from file:", JSON.stringify(readHistory, null, ' '));
    return true;
  }
  //failed to read history
  this.requiredHistory = this.settings.long;
  log.error("Failed to read history file for preload");
  log.error("Will warmup for", this.requiredHistory, 'candles');
  return false;
}

//Get settings object with updated indicator history
method.getSettingsWithIndicatorHistory = function () {
  let lp = this.indicators.long.prices;
  let o = _.clone(this.settings);
  //SMA indicator price arrays and Preload arrays ordered newest to oldest
  o.preload = lp.slice(0, o.long);
  return o;
}

//Serialize price arrays 
method.priceArr2str = function (numArr, elm) {
  let cArr = _.clone(numArr).reverse();
  return JSON.stringify(cArr, null, 0)
}

module.exports = method;
