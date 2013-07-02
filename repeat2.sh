BASE=http://datacache.org/dc/sync?
COM="streamOrder=true&return=stream&forceUpdate=true&forceWrite=true&inOrder=true&prefix=http://datacache.org/dc/demo/file&source=1.txt%0A2.txt"
N=100
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | md5sum
    #curl -s "$BASE&$COM" | head -1
	#curl -s "$BASE&$COM" 
done
