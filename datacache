#!/bin/bash
#
# Startup script for the DataCache server
#

PORT=8000
APP=/usr/local/datacache/app.js
NODE=/usr/bin/nodejs
LOG=/var/log/datacache

mkdir -p $LOG

case $1 in
	start)
	        sudo -u www-data $NODE $APP $PORT -id 1 >> $LOG/datacache.log 2>&1 &
	;;
	stop)
	        pid=`pgrep -f "$NODE $APP $PORT -id 1"`
	        sudo kill -9 $pid
	;;
	restart)
	        pid=`pgrep -f "$NODE $APP $PORT -id 1"`
	        sudo kill -9 $pid
	        /etc/init.d/datacache
	;;
	*)
		echo "Usage: /etc/init.d/datacache start|stop|restart"
	;;
esac

exit 0
