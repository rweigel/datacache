#!/usr/bin/sh

node app.js &

PID=$!

sleep 3

cd test; node streamTests.js 1> /dev/null

RESULT=$?

kill $PID

exit $RESULT

