#!/bin/sh

echo "Starting datacache server"

node app.js --port 7999 &

PID=$!

echo "Starting tests in 3 seconds."

sleep 3

cd test; node test.js --suite true --type stream

#sleep 1

RESULT=$?

kill $PID

exit $RESULT

