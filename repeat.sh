N=10
COM="streamOrder=true&streamFilterReadLines=10&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | md5sum
	#curl -s "$BASE&$COM" 
done

COM="streamOrder=true&streamFilterReadBytes=710&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | md5sum
	#curl -s "$BASE&$COM" 
done

COM="streamOrder=false&streamFilterReadBytes=710&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | sort | md5sum
	#curl -s "$BASE&$COM" 
done

COM="streamOrder=false&streamFilterReadLines=10&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | sort | md5sum
	#curl -s "$BASE&$COM" 
done

COM="streamOrder=true&streamFilter=replace('2000','2000')&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | sort | md5sum
done


COM="prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM"| sort | md5sum
done

COM="streamGzip=true&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
   # curl -s "$BASE&$COM" | gunzip | sort | md5sum
   curl -s "$BASE&$COM"
done
exit;
COM="streamGzip=true&streamOrder=true&prefix=$PREF&source=01vsec.sec%0A02vsec.sec"
echo $COM
for ((i=1; i <= $N ; i++)); do
    curl -s "$BASE&$COM" | gunzip | md5sum
done
