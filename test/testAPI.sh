# Return data for 404 address (should return nothing)
#curl "http://localhost:7999/sync?source=http://localhost:7999/404&return=stream&forceUpdate=true&forceWrite=true"

# Return info for 404 address
#curl "http://localhost:7999/sync?source=http://localhost:7999/404&forceUpdate=true&forceWrite=true"

# Return data for EADDRNOTAVAIL (should return nothing)
#curl "http://localhost:7999/sync?source=http://localhost:0/&return=stream&forceUpdate=true&forceWrite=true"

# Return info for EADDRNOTAVAIL
#curl "http://localhost:7999/sync?source=http://localhost:0/&forceUpdate=true&forceWrite=true"

# Return data for ECONNREFUSED (should return nothing)
#curl "http://localhost:7999/sync?source=http://localhost:22/&return=stream&forceUpdate=true&forceWrite=true"

# Return info for ECONNREFUSED
#curl "http://localhost:7999/sync?source=http://localhost:22/&forceUpdate=true&forceWrite=true"

#curl "http://localhost:7999/sync?source=http://localhost:7999/test/data/google.html&return=stream&forceUpdate=true&forceWrite=true"

#curl "http://localhost:7999/sync?source=http://localhost:7999/test/data/google.html&return=stream&lineRegExp=google&forceUpdate=true&forceWrite=true"

#curl "http://localhost:7999/sync?source=http://localhost:7999/test/data/google.html&lineRegExp=google&forceUpdate=true&forceWrite=true"

#curl "http://localhost:7999/sync?source=http://localhost:7999/test/data/google.html&lineRegExp=google"

#curl "http://localhost:7999/sync?source=http://localhost:7999/test/data/google.html&lineRegExp=google&forceWrite=true"

#curl "http://localhost:7999/sync?source=http://localhost:7999/test/data/google.html&return=stream&lineRegExp=google&streamFilterReadLines=1&forceUpdate=true&forceWrite=true"

curl -s -g "http://localhost:7999/sync?source=http://localhost:7999/test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeFunction=regrid&streamFilterExcludeColumnValues=99999,9999,999,99&streamFilterRegridDt=240000"

curl -s -g "http://localhost:7999/sync?source=http://localhost:7999/test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeFunction=regrid&streamFilterExcludeColumnValues=99999,9999,999,99&streamFilterRegridDt=480000"

curl -s -g "http://localhost:7999/sync?source=http://localhost:7999/test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeFunction=regrid&streamFilterExcludeColumnValues=99999,9999,999,99&streamFilterRegridDt=480001"

curl -s -g "http://localhost:7999/sync?source=http://localhost:7999/demo/file1.txt&return=stream&lineFormatter=formattedTime&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecols=1,2&forceUpdate=true"

curl -s -g "http://localhost:7999/sync?source=http://www.google.com%0Ahttp://www.yahoo.com&extractData=$(%22a%22).text()&return=stream&forceUpdate=true"

http://datacache.org/dc/sync?source=http://datacache.org/dc/demo/file1.txt%0Ahttp://datacache.org/dc/demo/file2.txt

http://datacache.org/dc/sync?prefix=http://datacache.org/dc/demo/&source=file1.txt%0Afile2.txt

http://datacache.org/dc/sync?source=http://datacache.org/dc/demo/file1.txt%0Ahttp://datacache.org/dc/demo/file2.txt

http://datacache.org/dc/sync?template=http://datacache.org/dc/demo/file$Y$m$d.txt&timeRange=1999-01-01/1999-01-03

http://datacache.org/dc/sync?template=http://datacache.org/dc/demo/file%d.txt&indexRange=1/2

http://datacache.org/dc/sync?source=http://localhost:8000/demo/file1.txt&return=stream&lineFormatter=formattedTime&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecols=1,2&forceUpdate=true

