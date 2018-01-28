#Put gekko.service file in: /lib/systemd/system
#Run: 
#sudo cp gekko.service /lib/systemd/system
#sudo chmod 644 /lib/systemd/system/gekko.service
#chmod +x /home/pi/gekko/start-conf-and-log-to-file.sh
#sudo systemctl daemon-reload
#sudo systemctl enable gekko.service

# Check status
#sudo systemctl status gekko.service
# Start service
#sudo systemctl start gekko.service
# Stop service
#sudo systemctl stop gekko.service
# Check service's log
sudo journalctl -f -u gekko.service
