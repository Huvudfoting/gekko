/*
  This custom strategy tries to limit loss while not missing out on too much profit.
  It tracks 3 EMAs (short, mid and long).
  It will buy on golden crosses between mid EMA & long EMA.
  It will sell on death crosses between short EMA & long EMA.
  It will stoploss to avoid big losses on any singel exposure.
  The bot will suicide on losing too much principal.

  TLDR: Lazy buyer, eager seller. But will ride a bull run.

  Example setting toml:
    short = 20
    mid = 40
    long = 84
    stoploss = 8
    maxlostprincipal = 40
    assumefee = 0.05
    assumeslippage = 0.05
    verbose = true
*/

// helpers
var _ = require('lodash');
var log = require('../core/log.js');

var strat = {};

// prepare everything our method needs
strat.init = function () {
  this.name = 'PLOUTOS';
  this.version = '1.0.0'
  this.prefix = '#';
  this.verbose = this.settings.verbose;
  this.requiredHistory = this.tradingAdvisor.historySize; //warm-up period
  this.live = true;
  //Buy/sell-states and keeping track of money
  this.assets = {
    age: 0,
    neverTraded: true, //hasn't made any trade yet, can advice both buy and sell
    boughtIn: false,
    currentCandle: null,
    boughtCandle: null,
    soldCandle: null,
    maxLossPrincipal: this.settings.maxlostprincipal,
    stopLoss: this.settings.stoploss,
    profitCurrentTrade: 0, //%
    principalLeft: 100, //%
    assumeFee: (this.settings.assumefee + this.settings.assumeslippage) / 100 //%
  }

  // define the indicators we need
  let buyCrossParam = {
    short: this.settings.mid,
    long: this.settings.long
  };
  let sellCrossParam = {
    short: this.settings.short,
    long: this.settings.long
  };
  this.addIndicator('emaBuyCross', 'EMAcross', buyCrossParam);
  this.addIndicator('emaSellCross', 'EMAcross', sellCrossParam);
  this.lastBuyEmaState = null;
  this.emaBuyState = null;
  this.emaSellState = null;
  this.buyCrosses = null;
  this.sellCrosses = null;

  //Log startup message
  log.debug('---------- STARTUP ---------------');
  log.debug(this.prefix, 'Strategy:', this.name, this.version);
  log.debug(this.prefix, 'EMA short:', this.settings.short, 'candles');
  log.debug(this.prefix, 'EMA mid:', this.settings.mid, 'candles');
  log.debug(this.prefix, 'EMA long:', this.settings.long, 'candles');
  log.debug(this.prefix, 'Warmup:', this.requiredHistory, 'candles');
  log.debug(this.prefix, 'Stop-loss:', this.settings.stoploss, '%');
  log.debug(this.prefix, 'Bot suicides on losing', this.settings.maxlostprincipal, '% principal');
  log.debug('----------------------------------');
}

// what happens on every new candle?
strat.update = function (candle) {
  // Calculate values and remember state for next candle
  this.emaBuyState = this.indicators.emaBuyCross.state;
  this.buyCrosses = this.calculateEmaCrosses(this.emaBuyState, this.lastBuyEmaState);
  this.lastBuyEmaState = _.clone(this.emaBuyState);

  this.emaSellState = this.indicators.emaSellCross.state;
  this.sellCrosses = this.calculateEmaCrosses(this.emaSellState, this.lastSellEmaState);
  this.lastSellEmaState = _.clone(this.emaSellState);

  //Calculate % profit on this exposure and remaining principal (%)
  this.updateAssets(candle);
}

strat.updateAssets = function (currentCandle) {
  let a = this.assets;
  a.age++;
  a.currentCandle = currentCandle;

  if (a.boughtIn && a.boughtCandle !== null && currentCandle !== null) {
    //Update profitCurrentTrade
    a.profitCurrentTrade = (1 - a.boughtCandle.close / currentCandle.close) * 100 * (1 - a.assumeFee);
  } else if (!a.boughtIn && a.boughtCandle !== null) {
    //Update principalLeft
    a.principalLeft = a.principalLeft * (1 + a.profitCurrentTrade / 100) * (1 - a.assumeFee);
    //Clean
    a.profitCurrentTrade = 0;
    a.boughtCandle = null;
  }
}

strat.check = function (candle) {
  //Make no decisions if bot is dead
  if (!this.live) {
    this.advice();
    return;
  }
  let a = this.assets;
  //Advice short on stoploss
  if (a.profitCurrentTrade + a.stopLoss < 0) {
    this.giveAdvice(candle, false, true, "STOPLOSS");
    return;
  }

  //advice short on low principal
  if (a.principalLeft < (100 - a.maxLossPrincipal)) {
    this.giveAdvice(candle, false, true, "HARAKIRI!");
    this.live = false; //kill bot!
    return;
  }

  //advice on EMA crosses 
  let buyAction = this.getEmaAction(candle, this.buyCrosses);
  let sellAction = this.getEmaAction(candle, this.sellCrosses);
  let sell = this.decideSellAdvice(sellAction);
  let buy = this.decideBuyAdvice(buyAction);
  //reason
  //log.debug(this.prefix, this.assets.age, buyAction, sellAction)  
  let msg = "";
  if (buy) msg = buyAction;
  if (sell) msg = sellAction;
  this.giveAdvice(candle, buy, sell, msg);
}

// Decide advice to trader
strat.decideBuyAdvice = function (action) {
  let a = this.assets;
  let buy = false;
  if (action === 'dblGoldenCross') {
    buy = true;
  } else if (action === 'bothUp' && a.neverTraded) {
    buy = true;
  }
  return buy;
};

strat.decideSellAdvice = function (action) {
  let a = this.assets;
  let sell = false;
  if (action === 'dblDeathCross') {
    sell = true;
  } else if (action === 'deathCross') {
    sell = true;
  } else if (action === 'bothDown' && a.neverTraded) {
    sell = true;
  }

  return sell;
};

strat.giveAdvice = function (candle, buy, sell, msg) {
  var a = this.assets;

  if (buy && !sell && (!a.boughtIn || a.neverTraded)) {
    //advice long
    this.advice('long');
    //update assets & log
    this.updateTrade(true, candle);
    this.logBuy(candle, msg);
    return;
  } else if (!buy && sell && (a.boughtIn || a.neverTraded)) {
    //advice short
    this.advice('short');
    //update assets & log
    this.updateTrade(false, candle);
    this.logSell(candle, msg);
    return;
  }

  this.advice();
}

strat.updateTrade = function (isBuy, candle) {
  let a = this.assets;
  a.neverTraded = false;
  a.boughtIn = isBuy;
  if (isBuy) {
    a.boughtCandle = candle;
  } else {
    a.soldCandle = candle;
  }
}

strat.logBuy = function (candle, msg) {
  let a = this.assets;
  log.info(this.prefix, '<<<<<<<<<<<', 'BUY @', a.age, '>>>>>>>>>>>');
  log.info(this.prefix, "Price:", candle.close.toFixed(2), "Reason:", msg);
  log.info(this.prefix, "Aprox principal:", a.principalLeft.toFixed(2), "%");
}

strat.logSell = function (candle, msg) {
  let a = this.assets;
  log.info(this.prefix, '<<<<<<<<<<<', 'SELL @', a.age, '>>>>>>>>>>');
  var adjPrincipal = a.principalLeft + a.profitCurrentTrade; //principal not updated until next candle update()
  log.info(this.prefix, "Price:", candle.close.toFixed(2), "Reason:", msg);
  log.info(this.prefix, "Profit:", a.profitCurrentTrade.toFixed(2), "%", "Aprox principal:", adjPrincipal.toFixed(2), "%");
}

strat.getEmaAction = function (candle, crosses) {
  if (crosses.goldenCross && crosses.shortUp && crosses.longUp) {
    return 'dblGoldenCross';
  } else if (crosses.deathCross && !crosses.shortUp && !crosses.longUp) {
    return 'dblDeathCross';
  } else if (crosses.goldenCross) {
    return 'goldenCross';
  } else if (crosses.deathCross) {
    return 'deathCross';
  } else if (crosses.shortUp && crosses.longUp) {
    return 'bothUp';
  } else if (!crosses.shortUp && !crosses.longUp) {
    return 'bothDown';
  }
  return "noop";
}

strat.calculateEmaCrosses = function (newState, lastState) {
  let crosses = {
    //Diffs
    priceDiff: 0,
    shortDiff: 0,
    longDiff: 0,
    //Ups & downs
    priceUp: false,
    shortUp: false,
    longUp: false,
    //Crosses
    cross: false,
    goldenCross: false,
    deathCross: false,
  };

  if (lastState != null) {
    //Get diffs
    crosses.priceDiff = newState.price - lastState.price;
    crosses.shortDiff = newState.short - lastState.short;
    crosses.longDiff = newState.long - lastState.long;

    //Get ups and downs 
    crosses.priceUp = crosses.priceDiff > 0;
    crosses.shortUp = crosses.shortDiff > 0;
    crosses.longUp = crosses.longDiff > 0;

    //Get crosses
    if (newState.short > newState.long && lastState.long > lastState.short) {
      crosses.cross = true;
      crosses.goldenCross = true;
    }
    if (newState.long > newState.short && lastState.short > lastState.long) {
      crosses.cross = true;
      crosses.deathCross = true;
    }
  }

  return crosses;
}

// for debugging purposes
strat.log = function () {
  if (this.live && this.verbose && this.assets != null) {
    let a = this.assets;
    log.debug(this.prefix, '-----', 'Candle', a.age, '-----');
    if (a.boughtIn) {
      //Log in market
      log.debug(this.prefix, '[IN] P/L', a.profitCurrentTrade.toFixed(2), '% ~principal:', a.principalLeft.toFixed(2), '%');
      if (a.boughtCandle !== null && a.currentCandle !== null) {
        log.debug(this.prefix, 'Current:', a.currentCandle.close.toFixed(2), 'Bought at:', a.boughtCandle.close.toFixed(2));
      }
    } else {
      //Log out of market
      log.debug(this.prefix, '[OUT] ~principal:', a.principalLeft.toFixed(2), '%');
      let soldAt = (a.soldCandle !== null) ? a.soldCandle.close.toFixed(2) : "";
      if (a.currentCandle !== null) {
        log.debug(this.prefix, 'Current:', a.currentCandle.close.toFixed(2), 'Sold at:', soldAt);
      }
    }
    log.debug(this.prefix, 'EMA crosses:');
    log.debug(this.prefix, '(B)', this.emaToString(this.emaBuyState, this.buyCrosses));
    log.debug(this.prefix, '(S)', this.emaToString(this.emaSellState, this.sellCrosses));
    log.debug(this.prefix, '--- End Candle', a.age, '---');
  }

}

//EMA-cross indicator as human readable string
strat.emaToString = function (emaState, crosses) {
  let sCross = 'C:' + crosses.cross;
  let sShort = ' S:' + emaState.short.toFixed(2) + '(' + crosses.shortDiff.toFixed(2) + ')';
  let sLong = ' L:' + emaState.long.toFixed(2) + '(' + crosses.longDiff.toFixed(2) + ')';
  return sCross + sShort + sLong;
}

module.exports = strat;
