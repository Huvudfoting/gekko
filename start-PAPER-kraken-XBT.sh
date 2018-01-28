stdbuf -o 0 /usr/bin/node /home/pi/gekko/gekko --config 
kraken-PAPER-XBTEUR.config.js 2>&1 | 
tee /home/pi/gekko-logs/paper-trading-kraken.log

