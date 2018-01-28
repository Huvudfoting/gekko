stdbuf -o 0 node gekko --config 
kraken-PAPER-XBTEUR.config.js 2>&1 | 
tee logs/paper-trading-kraken.log

