#!/bin/sh

echo "Starting datacache server"

#node app.js 7999 --debugstreamconsole=true &
node app.js --port 7999 &

PID=$!

echo "Starting tests in 3 seconds."

sleep 3

cd test; node streamTests.js --suite true --type stream
#cd test; node streamTests.js --sync=false --start=2 --all=false --n=1 --server=http://localhost:7999/ --serverdata=http://localhost:7999/
#cd test; node streamTests.js --sync=false --start=2 --all=false --n=10 --server=http://localhost:7999/ --serverdata=http://localhost:7999/
#cd test; node streamTests.js --sync=false --start=13 --all=false --n=10 --server=http://localhost:7999/ --serverdata=http://mag.gmu.edu/datacache/
#cd test; node streamTests.js --n=1 --showdiffs=false --start=0 --all=false
#cd test; node streamTests.js
#cd test; node streamTests.js --sync=true  --start=0 --all=true --n=10 --server=http://localhost:7999/ --serverdata=http://mag.gmu.edu/datacache/

#sleep 1

RESULT=$?

kill $PID

exit $RESULT

