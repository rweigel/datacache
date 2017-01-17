#!/bin/bash

echo "Starting datacache server"

node app.js --port 7998 &

PID=$!

echo "Starting tests in 3 seconds."

sleep 3

cd test; node test.js --suite true --type stream -n 1

RESULT1=$?

node test.js --suite true --type api -n 1

RESULT2=$?

kill $PID

echo "node formattedTimeTest.js"
node formattedTimeTest.js

RESULT0=$?

if [[ $RESULT1 == "0" && $RESULT1 == "1" && $RESULT2 == "1" ]]; then
	echo "test.sh Exiting with code 1"
	exit 1
else
	echo "test.sh Exiting with code 0"
	exit 0
fi

