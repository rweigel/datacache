#!/bin/sh

echo "Starting datacache server"

node app.js 7999 &

PID=$!

ulimit -n 1024

echo "Starting tests in 3 seconds."

sleep 3

cd test; node streamTests.js --n=5 --showdiffs=false

#cd test; node streamTests.js
#cd test; node streamTests.js --sync=true  --start=0 --all=true --n=10 --server=http://localhost:7999/ --serverdata=http://mag.gmu.edu/datacache/

RESULT=$?

kill $PID

exit $RESULT

