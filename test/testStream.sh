#!/bin/sh

echo "Starting datacache server"

node app.js 7999 &

PID=$!

echo "Starting tests in 3 seconds."

sleep 3

#cd test; nodejs streamTests.js 1> /dev/null
cd test; nodejs streamTests.js

RESULT=$?

kill $PID

exit $RESULT

