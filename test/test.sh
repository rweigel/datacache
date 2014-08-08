#!/usr/bin/sh

echo "Starting datacache server"

node app.js &

PID=$!

echo "Starting tests in 3 seconds."

sleep 3

node test/devTest.js

RESULT=$?

kill $PID

exit $RESULT

