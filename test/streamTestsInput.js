// Testing streamOrder, streamFilterReadLines, and streamFilterReadBytes 

var args      = server + "sync?return=stream&forceUpdate=true&forceWrite=true&lineRegExp=^[0-9]";

// Base test.
var source    = "01vmin.min%0A02vmin.min";
var tests     = [];
var j = 0;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = n || 50;
//tests[j].md5  = "8ee474572d7118be2a842fb140337cd9";
tests[j].md5  = "651f75d088a29b4a0a95e97a1bcccd48";

var j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamGzip=true&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = n || 50;
//tests[j].md5  = "8ee474572d7118be2a842fb140337cd9";
tests[j].md5  = "651f75d088a29b4a0a95e97a1bcccd48";

// Stream order = false.  Sorted stream should have same md5 as previous.
j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = n || 50;
//tests[j].md5  = "8ee474572d7118be2a842fb140337cd9";
tests[j].md5  = "651f75d088a29b4a0a95e97a1bcccd48";

// The following two should be the same as the above, but the line reader
// does not preserve the newline character - it replaces it with \n.
j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = false;
tests[j].n    = n || 50;
tests[j].md5  = "8ee474572d7118be2a842fb140337cd9";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = true;
tests[j].n    = n || 50;
tests[j].md5  = "8ee474572d7118be2a842fb140337cd9";

// Base test.
var source    = "03vmin.min%0A04vmin.min%0A05vmin.min";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = n || 50;
//tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";
tests[j].md5  = "cef9e50efae894c42293ed5922af2b8e";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadLines=10&prefix="+prefix+"&source="+source;
tests[j].n    = n || 50;
//tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";
tests[j].md5  = "cef9e50efae894c42293ed5922af2b8e";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].n    = n || 50;
tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadBytes=720&prefix="+prefix+"&source="+source;
tests[j].sort = true;
tests[j].n    = n || 50;
tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=true&streamFilterReadLines=10&streamFilter=replace('2013','2013')&prefix="+prefix+"&source="+source;
tests[j].n    = n || 50;
//tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";
tests[j].md5  = "cef9e50efae894c42293ed5922af2b8e";

j = j+1;
tests[j]      = {};
tests[j].url  = args + "&streamOrder=false&streamFilterReadBytes=720&streamFilter=replace('2013','2013')&prefix="+prefix+"&source="+source;
tests[j].n    = n || 50;
tests[j].md5  = "4dcc638a9d40bdf4f4c1c6d38ecfa979";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"demo/file1.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterReadPosition=360&streamFilterReadLines=1&streamFilterTimeFormat=1";
tests[j].n    = n || 50;
tests[j].md5  = "6e6f9f545e1e4a9db5e3bea91609b4e5";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"demo/file1.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterReadPosition=360&streamFilterReadLines=1&streamFilterTimeFormat=0";
tests[j].n    = n || 50;
tests[j].md5  = "755c81782ceb9bf9a391daee92ee2396";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"demo/file1.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=false&forceWrite=false&streamFilterReadPosition=360&streamFilterReadLines=1&streamFilterTimeFormat=0";
tests[j].n    = n || 50;
tests[j].md5  = "755c81782ceb9bf9a391daee92ee2396";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync/?plugin=swpcKpAp2Day&template=http://datacache.org/data/www.swpc.noaa.gov/ftpdir/lists/geomag/%Y%mAK.txt&timeRange=2010-01-01/2010-01-02&forceUpdate=true&forceWrite=true&return=stream&lineRegExp=&timecolumns=1,2&timeformat=yyyy-MM-dd%20HH:mm";
tests[j].n    = n || 50;
tests[j].md5  = "4359cba956b4b416d86743cef6c3586b";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync/?plugin=swpcKpAp2Day&template=http://datacache.org/data/www.swpc.noaa.gov/ftpdir/lists/geomag/%Y%mAK.txt&timeRange=2010-01-01/2010-01-02&forceUpdate=false&forceWrite=false&return=stream&lineRegExp=&timecolumns=1,2&timeformat=yyyy-MM-dd%20HH:mm";
tests[j].n    = n || 50;
tests[j].md5  = "4359cba956b4b416d86743cef6c3586b";


j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync/?plugin=swpcKpAp2Day&template=http://datacache.org/data/www.swpc.noaa.gov/ftpdir/lists/geomag/%Y%mAK.txt&timeRange=2010-01-01/2010-01-02&forceUpdate=true&forceWrite=true&return=stream&lineRegExp=&timecolumns=1,2&timeformat=yyyy-MM-dd%20HH:mm&streamFilterReadColumns=1,7";
tests[j].n    = n || 50;
tests[j].md5  = "ab2240a0161c5540fda5e1370efbaa5c";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync/?plugin=swpcKpAp2Day&template=http://datacache.org/data/www.swpc.noaa.gov/ftpdir/lists/geomag/%Y%mAK.txt&timeRange=2010-01-01/2010-01-02&forceUpdate=false&forceWrite=false&return=stream&lineRegExp=&timecolumns=1,2&timeformat=yyyy-MM-dd%20HH:mm&streamFilterReadColumns=1,7";
tests[j].n    = n || 50;
tests[j].md5  = "ab2240a0161c5540fda5e1370efbaa5c";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"test/data/filetoaverage1.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeWindow=2&streamFilterComputeFunction=mean";
tests[j].n    = n || 50;
tests[j].md5  = "f2ccf3160211039093c8029eccb9d533";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeWindow=2&streamFilterComputeFunction=stats&streamFilterExcludeColumnValues=99999,9999,999,99";
tests[j].n    = n || 50;
tests[j].md5  = "e585ef1aef0f3ee561b23613205e8396";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeWindow=2&streamFilterComputeFunction=Nvalid&streamFilterExcludeColumnValues=99999,9999,999,99";
tests[j].n    = n || 50;
tests[j].md5  = "b36ef7925e883243b2779b8517991603";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeWindow=2&streamFilterComputeFunction=max&streamFilterExcludeColumnValues=99999,9999,999,99";
tests[j].n    = n || 50;
tests[j].md5  = "5bfe3b84476742c44bf0bc849e9d62cf";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeWindow=2&streamFilterComputeFunction=min&streamFilterExcludeColumnValues=99999,9999,999,99";
tests[j].n    = n || 50;
tests[j].md5  = "7b24fca04785d3d5a6c78266fb18d2c0";

j = j+1;
tests[j]      = {};
tests[j].url  = server + "sync?source="+server+"test/data/filetoaverage1withNaN.txt&return=stream&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecolumns=1,2&streamFilterReadColumns=1,2,3,4,5,6&forceUpdate=true&forceWrite=true&streamFilterTimeFormat=1&streamFilterComputeWindow=2&streamFilterComputeFunction=std&streamFilterExcludeColumnValues=99999,9999,999,99";
tests[j].n    = n || 50;
tests[j].md5  = "455059d55577eba3416476df4412e54b";