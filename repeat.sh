COM="inOrder=true&streamFilterReadLines=10&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | md5
	#curl -s "$BASE&$COM" 
done

COM="inOrder=true&streamFilterReadBytes=710&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | md5
	#curl -s "$BASE&$COM" 
done

COM="inOrder=false&streamFilterReadBytes=710&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | sort | md5
	#curl -s "$BASE&$COM" 
done

COM="inOrder=false&streamFilterReadLines=10&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | sort | md5
	#curl -s "$BASE&$COM" 
done

COM="inOrder=true&streamFilter=replace('2000','2000')&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | sort | md5
done

COM="prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM"| sort | md5
done

COM="streamGzip=true&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | gunzip | sort | md5
done

COM="streamGzip=true&inOrder=true&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | gunzip | md5
done
