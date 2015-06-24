// Testing API

var tests     = [];

// Request is for a page that does not exist (should return nothin)
var args      = "sync?return=stream&forceUpdate=true&forceWrite=true";
var j = 0;
tests[j]      = {};
tests[j].url  = server + args + "&prefix="+serverdata+"&source=404"
tests[j].n    = n || 50;
tests[j].md5  = "d41d8cd98f00b204e9800998ecf8427e";

// Request is for two (identical) URLs that do not exist (should return nothing)
var args      = "sync?return=stream&forceUpdate=true&forceWrite=true";
var j = j+1;
tests[j]      = {};
tests[j].url  = server + args + "&prefix="+serverdata+"&source=404%0A404"
tests[j].n    = n || 50;
tests[j].md5  = "d41d8cd98f00b204e9800998ecf8427e";

// Request is for two different URLs that do not exist (should return nothing)
var args      = "sync?return=stream&forceUpdate=true&forceWrite=true";
var j = j+1;
tests[j]      = {};
tests[j].url  = server + args + "&prefix="+serverdata+"&source=404%0A400"
tests[j].n    = n || 50;
tests[j].md5  = "d41d8cd98f00b204e9800998ecf8427e";

// Return data for EADDRNOTAVAIL (should return nothing)
var args      = "sync?return=stream&forceUpdate=true&forceWrite=true"
j = j+1;
tests[j]      = {};
tests[j].url  = server + args + "&prefix=http://localhost:0/&source=404%0A400"
tests[j].n    = n || 50;
tests[j].md5  = "d41d8cd98f00b204e9800998ecf8427e";

// Return data for ECONNREFUSED (should return nothing)
j = j+1;
tests[j]      = {};
tests[j].url  = server + args + "&prefix=http://localhost:22/&source=404%0A400"
tests[j].n    = n || 50;
tests[j].md5  = "d41d8cd98f00b204e9800998ecf8427e";

