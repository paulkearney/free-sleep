#!/bin/bash

# Optional: Exit immediately on error
set -e

# Name of the backup folder with a timestamp

BACKUP_PATH="/home/dac/free-sleep-backup"

systemctl stop free-sleep
systemctl disable free-sleep

# Unblock internet first
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh

# If a free-sleep folder exists, back it up
if [ -d /home/dac/free-sleep ]; then
  echo "Backing up current free-sleep to $BACKUP_PATH"
  mv /home/dac/free-sleep $BACKUP_PATH
fi

echo "Attempting to reinstall free-sleep..."
if /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/throwaway31265/free-sleep/main/scripts/install.sh)"; then
  echo "Reinstall successful."
  if [ -f "$BACKUP_PATH/server/.env.pod" ]; then
    echo "Restoring existing .env.pod configuration..."
    cp "$BACKUP_PATH/server/.env.pod" /home/dac/free-sleep/server/.env.pod
    chown dac:dac /home/dac/free-sleep/server/.env.pod
  fi
  if [ -f "$BACKUP_PATH/server/.env.local" ]; then
    echo "Restoring existing .env.local configuration..."
    cp "$BACKUP_PATH/server/.env.local" /home/dac/free-sleep/server/.env.local
    chown dac:dac /home/dac/free-sleep/server/.env.local
  fi
  rm -rf "$BACKUP_PATH"
else
  echo "Reinstall failed. Restoring from backup..."
  rm -rf /home/dac/free-sleep
  mv "$BACKUP_PATH" /home/dac/free-sleep
  systemctl enable free-sleep
  systemctl start free-sleep
fi

# Block internet access again
sh /home/dac/free-sleep/scripts/block_internet_access.sh
echo -e "\033[0;32mUpdate completed successfully!\033[0m"
echo -e "\033[0;32mRestart your pod with 'reboot -h now'\033[0m"
