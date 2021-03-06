LOCAL="http://localhost:7999"

curl -s -g "http://localhost:7999/sync?return=stream&forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]&streamOrder=true&streamFilterReadLines=10&prefix=http://localhost:7999/&source=test/data/bou20130801vmin.min%0Atest/data/bou20130802vmin.min" > a
curl -s -g "http://localhost:7999/sync?return=stream&forceUpdate=false&forceWrite=false&lineRegExp=^[0-9]&streamOrder=true&streamFilterReadLines=10&prefix=http://localhost:7999/&source=test/data/bou20130801vmin.min%0Atest/data/bou20130802vmin.min" > b
diff a b
exit 1
time curl -g "http://localhost:7999/sync/?&template=$LOCAL/test/data/bdt%Y%m%dvsec.sec&lineRegExp=^[0-9]&timeRange=2015-06-28T00:00:00.000/2015-06-29T00:00:00.000&return=stream&forceUpdate=true&forceWrite=true&streamFilterReadTimeStart=2015-06-28T23:59:00.000&streamFilterReadTimeFormat=\$Y-\$m-\$d,\$H:\$M:\$S.\$(millis)"

time curl -g "http://localhost:7999/sync/?&template=$LOCAL/test/data/bdt%Y%m%dvsec.sec&lineRegExp=^[0-9]&timeRange=2015-06-28T00:00:00.000/2015-06-29T00:00:00.000&return=stream&forceUpdate=false&forceWrite=false&streamFilterReadTimeStart=2015-06-28T23:59:00.000&streamFilterReadTimeFormat=\$Y-\$m-\$d,\$H:\$M:\$S.\$(millis)"

exit 1
exit 1
# Transfer these to apiTestsInput.js after testing


BASE="$LOCAL/sync?source=$LOCAL/test/data/google.html&lineRegExp=google"

#curl -s -g "$BASE&forceUpdate=true&forceWrite=true"
#curl -s -g "$BASE&forceUpdate=true"
#touch data/google.html


#curl -s -g "$BASE&forceUpdate=true"
#touch data/google.html
#curl -s -g "$BASE&respectHeaders=false"

#touch data/google.html
#curl -s -g "$BASE&streamFilterReadLines=1&return=stream"
#touch data/google.html
#curl -s -g "$BASE&streamFilterReadLines=1&return=stream&respectHeaders=false"


# Test of template and prefix
#curl -s -g "$LOCAL/sync?source=$LOCAL/test/data/file1.txt%0A$LOCAL/test/data/file2.txt&forceUpdate=true&forceWrite=true"
#curl -s -g "$LOCAL/sync?prefix=$LOCAL/test/data/&source=file1.txt%0Afile2.txt&forceUpdate=true&forceWrite=true"
#curl -s -g "$LOCAL/sync?template=$LOCAL/test/data/file%d.txt&indexRange=1/2&forceUpdate=true&forceWrite=true"
#curl -s -g "$LOCAL/sync?template=$LOCAL/test/data/file%Y%m%d.txt&timeRange=1999-01-01/1999-01-03&forceUpdate=true&forceWrite=true"

# Tests of extractData
#curl -s -g "$LOCAL/sync?source=$LOCAL/test/data/a.html&extractData=jQuery(%22p%22).text()&return=stream&forceUpdate=true&forceWrite=true"
#curl -s -g "$LOCAL/sync?source=$LOCAL/test/data/a.html%0A$LOCAL/test/data/b.html&extractData=jQuery(%22a%22).text()&return=stream&forceUpdate=true&forceWrite=true"

#BASE="$LOCAL/sync?source=$LOCAL/demo/file1.txt&return=stream&forceUpdate=true&forceWrite=true"
# %23 is # 
#curl -s -g "$BASE&lineRegExp=^%23"

BASE="$LOCAL/sync?source=$LOCAL/test/data/file1.txt&return=stream&forceUpdate=true&forceWrite=true"
# %23 is # 
curl -s -g "$BASE&lineRegExp=^%23"

exit 1

BASE="$LOCAL/sync?source=$LOCAL/test/data/file1.txt&return=stream&forceUpdate=true"
# %23 is # 
curl -s -g "$BASE&lineRegExp=^%23"


curl -s -g "$BASE&lineRegExp=^02-01-2005%2000:04:00.000"

curl -s -g "$BASE&lineRegExp=^02-01-2005+00:04:00.000"

curl -s -g "$BASE&lineRegExp=^[0-9]"

# Stream tests

curl -s -g "$BASE&streamFilterReadLineRegExp=^[0-9]"

BASE="$BASE&streamFilterReadLines=10"

curl -s -g "$BASE"

curl -s -g "$BASE&streamFilterReadStart=5"

curl -s -g "$BASE&streamFilterReadColumns=1"

curl -s -g "$BASE&streamFilterReadColumns=2"

curl -s -g "$BASE&streamFilterReadColumns=1,2"

BASE="$BASE&streamFilterReadColumns=1,2,3"

curl -s -g "$BASE&streamFilterReadTimeFormat=\$d-\$m-\$Y,\$H:\$M:\$S"

curl -s -g "$BASE&streamFilterReadTimeFormat=DD-MM-YYYY,HH:mm:ss.SSS"

BASE="$BASE&streamFilterReadTimeFormat=DD-MM-YYYY,HH:mm:ss.SSS"

curl -s -g "$BASE&streamFilterReadTimeColumns=1,2"

curl -s -g "$BASE&streamFilterWriteTimeFormat=0"

curl -s -g "$BASE&streamFilterWriteTimeFormat=1"

curl -s -g "$BASE&streamFilterWriteTimeFormat=2"

BASE="$BASE&streamFilterComputeFunction=regrid&streamFilterWriteComputeFunctionDt=120000"

curl -s -g "$BASE&streamFilterReadTimeStart=2005-01-02T00:04:00.0000Z"

curl -s -g "$BASE&streamFilterReadTimeStart=2005-01-02T00:04:00.0000Z&streamFilterReadTimeStop=2005-01-02T00:12:00.0000Z"

BASE="$BASE&streamFilterComputeFunction=regrid&streamFilterWriteComputeFunctionDt=480000"

curl -s -g "$BASE&streamFilterReadTimeStart=2005-01-02T00:04:00.0000Z"

curl -s -g "$BASE&streamFilterReadTimeStart=2005-01-02T00:04:00.0000Z&streamFilterReadTimeStop=2005-01-02T00:12:00.0000Z"

BASE="$BASE&streamFilterComputeFunction=regrid&streamFilterWriteComputeFunctionDt=1080000"

curl -s -g "$BASE&streamFilterReadTimeStart=2005-01-02T00:04:00.0000Z"

curl -s -g "$BASE&streamFilterReadTimeStart=2005-01-02T00:04:00.0000Z&streamFilterReadTimeStop=2005-01-02T00:12:00.0000Z"

BASE="$LOCAL/sync?source=$LOCAL/test/data/filetoaverage1withNaN.txt"
BASE="$BASE&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS"
BASE="$BASE&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true"
BASE="$BASE&streamFilterWriteComputeFunction=regrid"

curl -s -g "$BASE&streamFilterWriteComputeExcludes=99999,9999,999,99"
