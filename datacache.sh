#!/bin/bash
#
# Startup script for the DataCache server
#
PORT=8000
MEMORY=--max-old-space-size=1900
APP=/usr/local/datacache/app.js
NODE=/usr/bin/nodejs
LOG=/var/log/datacache

mkdir -p $LOG

case $1 in
        start)
                ulimit -n 1024
                sudo -u www-data $NODE $MEMORY $APP $PORT -id 1 >> $LOG/datacache.log 2>&1 &
        ;;
        stop)
                pid=`pgrep -f "$NODE $MEMORY $APP $PORT -id 1"`
                sudo kill -9 $pid
        ;;
        restart)
                pid=`pgrep -f "$NODE $MEMORY $APP $PORT -id 1"`
                sudo kill -9 $pid
                /etc/init.d/datacache
        ;;
        *)
                echo "Usage: /etc/init.d/datacache start|stop|restart"
        ;;
esac

exit 0