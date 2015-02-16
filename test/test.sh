#!/bin/sh

PORT=7998
echo "Starting datacache server on port $PORT"

node app.js --port=$PORT &

PID=$!

echo "Starting tests in 3 seconds."

sleep 3

node test/devTests.js http://localhost:$PORT/

RESULT=$?

kill $PID

exit $RESULT
