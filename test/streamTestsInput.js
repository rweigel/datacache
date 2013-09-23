// Testing streamOrder, streamFilterReadLines, and streamFilterReadBytes 

////////////////////////////////////////////////////////////////////////////
// Simulated server
// First two files are served without delay from 
// Next three files are served with random delay between 0 and 100 ms.
var n = 50;
var prefix = "http://datacache.org/dc/test/data-stream/bou201308";

// Mirror of real server.
var n = 50;
var prefix = "http://mag.gmu.edu/tmp/magweb.cr.usgs.gov/data/magnetometer/BOU/OneMinute/bou201308";

// Real server
var n = 10;
var prefix = "http://magweb.cr.usgs.gov/data/magnetometer/BOU/OneMinute/bou201308";

// Simulated server
// First two files are served without delay from 
// Next three files are served with random delay between 0 and 100 ms.
var n = 20;
var prefix = server + "test/data-stream/bou201308";
////////////////////////////////////////////////////////////////////////////

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
tests[j].url  = server + "sync?source=http://datacache.org/dc/demo/file1.txt&return=stream&lineFormatter=formattedTime&lineRegExp=^[0-9]&timeformat=DD-MM-YYYY,HH:mm:ss.SSS&timecols=1,2&streamFilterReadColumns=1,2,3,4,5&forceUpdate=true&forceWrite=true&streamFilterReadPosition=360&streamFilterReadLines=1";
tests[j].n    = n || 50;
tests[j].md5  = "6e6f9f545e1e4a9db5e3bea91609b4e5";

