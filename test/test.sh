#!/usr/bin/sh

node app.js &

PID=$!

sleep 3

node test/devTest.js

RESULT=$?

kill $PID

exit $RESULT

