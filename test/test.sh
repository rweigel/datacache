#!/bin/bash

echo "Starting datacache server"

node app.js --port 7999 &

PID=$!

echo "Starting tests in 3 seconds."

sleep 3

cd test; node test.js --suite true --type stream -n 1

RESULT1=$?

node test.js --suite true --type api -n 1

RESULT2=$?

#sleep 1

kill $PID

if [[ $RESULT1 == "1" && $RESULT2 == "1" ]]; then
	echo "test.sh Exiting with code 1"
	exit 1
else
	echo "test.sh Exiting with code 0"
	exit 0
fi

