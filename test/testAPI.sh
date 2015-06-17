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

# Problem: Last ">" missing
#curl "http://localhost:7999/sync?source=http://localhost:7999/test/data/google.html&return=stream&lineRegExp=google&streamFilterReadLines=1&forceUpdate=true&forceWrite=true"

curl -s -g "http://localhost:7999/sync?source=http://localhost:7999/test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeFunction=regrid&streamFilterExcludeColumnValues=99999,9999,999,99&streamFilterRegridDt=240000"
