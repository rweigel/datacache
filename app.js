var request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	express = require('express'),
	app = express.createServer(),
	crypto = require("crypto"),
	fs = require("fs");

var presets = [
	[
		"http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050101T000000Z,20050102T000000Z/Magnitude,BGSEc?format=text",
		"http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050102T000000Z,20050103T000000Z/Magnitude,BGSEc?format=text",
		"http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050103T000000Z,20050104T000000Z/Magnitude,BGSEc?format=text"
	], [
		"http://supermag.uib.no/cgi-bin/cgiwrap.cgi?command=../script/download.mag&cli=wei+19800101+00%3A00+24%3A00+-s+BRW+-ncol+ff333333+-smlcol+ff666666+-smucol+ff999999+-index+-imfgsm+-ymin+-800+-ymax+200...",
		"http://supermag.uib.no/cgi-bin/cgiwrap.cgi?command=../script/download.mag&cli=wei+19800102+00%3A00+24%3A00+-s+BRW+-ncol+ff333333+-smlcol+ff666666+-smucol+ff999999+-index+-imfgsm+-ymin+-800+-ymax+200...",
		"http://supermag.uib.no/cgi-bin/cgiwrap.cgi?command=../script/download.mag&cli=wei+19800103+00%3A00+24%3A00+-s+BRW+-ncol+ff333333+-smlcol+ff666666+-smucol+ff999999+-index+-imfgsm+-ymin+-800+-ymax+200..."
	], [
		"http://sscweb.gsfc.nasa.gov/cgi-bin/Locator.cgi?SPCR=ace&START_TIME=2000+200+00%3A00%3A00&STOP_TIME=2000+201+23%3A59%3A59&RESOLUTION=1&TOD=7&J2000=&GEO=&GM=&GSE=&GSM=&SM=&REG_OPT=&MNMX_FLTR_ACCURACY=2&OPT=&TRC_GEON=&TRC_GEOS=&TRC_GMN=&TRC_GMS=&FILTER_DIST_UNITS=1&TOD_APPLY_FILTER=&TODX_MNMX=&TOD_XGT=&TOD_XLT=&TODY_MNMX=&TOD_YGT=&TOD_YLT=&TODZ_MNMX=&TOD_ZGT=&TOD_ZLT=&TODLAT_MNMX=&TOD_LATGT=&TOD_LATLT=&TODLON_MNMX=&TOD_LONGT=&TOD_LONLT=&TODLT_MNMX=&TOD_LTGT=&TOD_LTLT=&J2000_APPLY_FILTER=&J2000X_MNMX=&J2000_XGT=&J2000_XLT=&J2000Y_MNMX=&J2000_YGT=&J2000_YLT=&J2000Z_MNMX=&J2000_ZGT=&J2000_ZLT=&J2000LAT_MNMX=&J2000_LATGT=&J2000_LATLT=&J2000LON_MNMX=&J2000_LONGT=&J2000_LONLT=&J2000LT_MNMX=&J2000_LTGT=&J2000_LTLT=&GEO_APPLY_FILTER=&GEOX_MNMX=&GEO_XGT=&GEO_XLT=&GEOY_MNMX=&GEO_YGT=&GEO_YLT=&GEOZ_MNMX=&GEO_ZGT=&GEO_ZLT=&GEOLAT_MNMX=&GEO_LATGT=&GEO_LATLT=&GEOLON_MNMX=&GEO_LONGT=&GEO_LONLT=&GEOLT_MNMX=&GEO_LTGT=&GEO_LTLT=&GM_APPLY_FILTER=&GMX_MNMX=&GM_XGT=&GM_XLT=&GMY_MNMX=&GM_YGT=&GM_YLT=&GMZ_MNMX=&GM_ZGT=&GM_ZLT=&GMLAT_MNMX=&GM_LATGT=&GM_LATLT=&GMLON_MNMX=&GM_LONGT=&GM_LONLT=&GMLT_MNMX=&GM_LTGT=&GM_LTLT=&GSE_APPLY_FILTER=&GSEX_MNMX=&GSE_XGT=&GSE_XLT=&GSEY_MNMX=&GSE_YGT=&GSE_YLT=&GSEZ_MNMX=&GSE_ZGT=&GSE_ZLT=&GSELAT_MNMX=&GSE_LATGT=&GSE_LATLT=&GSELON_MNMX=&GSE_LONGT=&GSE_LONLT=&GSELT_MNMX=&GSE_LTGT=&GSE_LTLT=&GSM_APPLY_FILTER=&GSMX_MNMX=&GSM_XGT=&GSM_XLT=&GSMY_MNMX=&GSM_YGT=&GSM_YLT=&GSMZ_MNMX=&GSM_ZGT=&GSM_ZLT=&GSMLAT_MNMX=&GSM_LATGT=&GSM_LATLT=&GSMLON_MNMX=&GSM_LONGT=&GSM_LONLT=&GSMLT_MNMX=&GSM_LTGT=&GSM_LTLT=&SM_APPLY_FILTER=&SMX_MNMX=&SM_XGT=&SM_XLT=&SMY_MNMX=&SM_YGT=&SM_YLT=&SMZ_MNMX=&SM_ZGT=&SM_ZLT=&SMLAT_MNMX=&SM_LATGT=&SM_LATLT=&SMLON_MNMX=&SM_LONGT=&SM_LONLT=&SMLT_MNMX=&SM_LTGT=&SM_LTLT=&OTHER_FILTER_DIST_UNITS=1&RD_APPLY=&FS_APPLY=&NS_APPLY=&BS_APPLY=&MG_APPLY=&LV_APPLY=&IL_APPLY=&REG_FLTR_SWITCH=&SCR_APPLY=&SCR=&RTR_APPLY=&RTR=&BTR_APPLY=&NBTR=&SBTR=&EXTERNAL=3&EXT_T1989c=1&KP_LONG_89=4&INTERNAL=1&ALTITUDE=100&DAY=1&TIME=3&DISTANCE=1&DIST_DEC=2&DEG=1&DEG_DEC=2&DEG_DIR=1&OUTPUT_CDF=1&LINES_PAGE=1&RNG_FLTR_METHOD=&PREV_SECTION=SCS&SSC=LOCATOR_GENERAL&SUBMIT=Submit+query+and+wait+for+output&.cgifields=SPCR",
		"http://sscweb.gsfc.nasa.gov/cgi-bin/Locator.cgi?SPCR=ace&START_TIME=2000+201+00%3A00%3A00&STOP_TIME=2000+202+23%3A59%3A59&RESOLUTION=1&TOD=7&J2000=&GEO=&GM=&GSE=&GSM=&SM=&REG_OPT=&MNMX_FLTR_ACCURACY=2&OPT=&TRC_GEON=&TRC_GEOS=&TRC_GMN=&TRC_GMS=&FILTER_DIST_UNITS=1&TOD_APPLY_FILTER=&TODX_MNMX=&TOD_XGT=&TOD_XLT=&TODY_MNMX=&TOD_YGT=&TOD_YLT=&TODZ_MNMX=&TOD_ZGT=&TOD_ZLT=&TODLAT_MNMX=&TOD_LATGT=&TOD_LATLT=&TODLON_MNMX=&TOD_LONGT=&TOD_LONLT=&TODLT_MNMX=&TOD_LTGT=&TOD_LTLT=&J2000_APPLY_FILTER=&J2000X_MNMX=&J2000_XGT=&J2000_XLT=&J2000Y_MNMX=&J2000_YGT=&J2000_YLT=&J2000Z_MNMX=&J2000_ZGT=&J2000_ZLT=&J2000LAT_MNMX=&J2000_LATGT=&J2000_LATLT=&J2000LON_MNMX=&J2000_LONGT=&J2000_LONLT=&J2000LT_MNMX=&J2000_LTGT=&J2000_LTLT=&GEO_APPLY_FILTER=&GEOX_MNMX=&GEO_XGT=&GEO_XLT=&GEOY_MNMX=&GEO_YGT=&GEO_YLT=&GEOZ_MNMX=&GEO_ZGT=&GEO_ZLT=&GEOLAT_MNMX=&GEO_LATGT=&GEO_LATLT=&GEOLON_MNMX=&GEO_LONGT=&GEO_LONLT=&GEOLT_MNMX=&GEO_LTGT=&GEO_LTLT=&GM_APPLY_FILTER=&GMX_MNMX=&GM_XGT=&GM_XLT=&GMY_MNMX=&GM_YGT=&GM_YLT=&GMZ_MNMX=&GM_ZGT=&GM_ZLT=&GMLAT_MNMX=&GM_LATGT=&GM_LATLT=&GMLON_MNMX=&GM_LONGT=&GM_LONLT=&GMLT_MNMX=&GM_LTGT=&GM_LTLT=&GSE_APPLY_FILTER=&GSEX_MNMX=&GSE_XGT=&GSE_XLT=&GSEY_MNMX=&GSE_YGT=&GSE_YLT=&GSEZ_MNMX=&GSE_ZGT=&GSE_ZLT=&GSELAT_MNMX=&GSE_LATGT=&GSE_LATLT=&GSELON_MNMX=&GSE_LONGT=&GSE_LONLT=&GSELT_MNMX=&GSE_LTGT=&GSE_LTLT=&GSM_APPLY_FILTER=&GSMX_MNMX=&GSM_XGT=&GSM_XLT=&GSMY_MNMX=&GSM_YGT=&GSM_YLT=&GSMZ_MNMX=&GSM_ZGT=&GSM_ZLT=&GSMLAT_MNMX=&GSM_LATGT=&GSM_LATLT=&GSMLON_MNMX=&GSM_LONGT=&GSM_LONLT=&GSMLT_MNMX=&GSM_LTGT=&GSM_LTLT=&SM_APPLY_FILTER=&SMX_MNMX=&SM_XGT=&SM_XLT=&SMY_MNMX=&SM_YGT=&SM_YLT=&SMZ_MNMX=&SM_ZGT=&SM_ZLT=&SMLAT_MNMX=&SM_LATGT=&SM_LATLT=&SMLON_MNMX=&SM_LONGT=&SM_LONLT=&SMLT_MNMX=&SM_LTGT=&SM_LTLT=&OTHER_FILTER_DIST_UNITS=1&RD_APPLY=&FS_APPLY=&NS_APPLY=&BS_APPLY=&MG_APPLY=&LV_APPLY=&IL_APPLY=&REG_FLTR_SWITCH=&SCR_APPLY=&SCR=&RTR_APPLY=&RTR=&BTR_APPLY=&NBTR=&SBTR=&EXTERNAL=3&EXT_T1989c=1&KP_LONG_89=4&INTERNAL=1&ALTITUDE=100&DAY=1&TIME=3&DISTANCE=1&DIST_DEC=2&DEG=1&DEG_DEC=2&DEG_DIR=1&OUTPUT_CDF=1&LINES_PAGE=1&RNG_FLTR_METHOD=&PREV_SECTION=SCS&SSC=LOCATOR_GENERAL&SUBMIT=Submit+query+and+wait+for+output&.cgifields=SPCR",
		"http://sscweb.gsfc.nasa.gov/cgi-bin/Locator.cgi?SPCR=ace&START_TIME=2000+202+00%3A00%3A00&STOP_TIME=2000+203+23%3A59%3A59&RESOLUTION=1&TOD=7&J2000=&GEO=&GM=&GSE=&GSM=&SM=&REG_OPT=&MNMX_FLTR_ACCURACY=2&OPT=&TRC_GEON=&TRC_GEOS=&TRC_GMN=&TRC_GMS=&FILTER_DIST_UNITS=1&TOD_APPLY_FILTER=&TODX_MNMX=&TOD_XGT=&TOD_XLT=&TODY_MNMX=&TOD_YGT=&TOD_YLT=&TODZ_MNMX=&TOD_ZGT=&TOD_ZLT=&TODLAT_MNMX=&TOD_LATGT=&TOD_LATLT=&TODLON_MNMX=&TOD_LONGT=&TOD_LONLT=&TODLT_MNMX=&TOD_LTGT=&TOD_LTLT=&J2000_APPLY_FILTER=&J2000X_MNMX=&J2000_XGT=&J2000_XLT=&J2000Y_MNMX=&J2000_YGT=&J2000_YLT=&J2000Z_MNMX=&J2000_ZGT=&J2000_ZLT=&J2000LAT_MNMX=&J2000_LATGT=&J2000_LATLT=&J2000LON_MNMX=&J2000_LONGT=&J2000_LONLT=&J2000LT_MNMX=&J2000_LTGT=&J2000_LTLT=&GEO_APPLY_FILTER=&GEOX_MNMX=&GEO_XGT=&GEO_XLT=&GEOY_MNMX=&GEO_YGT=&GEO_YLT=&GEOZ_MNMX=&GEO_ZGT=&GEO_ZLT=&GEOLAT_MNMX=&GEO_LATGT=&GEO_LATLT=&GEOLON_MNMX=&GEO_LONGT=&GEO_LONLT=&GEOLT_MNMX=&GEO_LTGT=&GEO_LTLT=&GM_APPLY_FILTER=&GMX_MNMX=&GM_XGT=&GM_XLT=&GMY_MNMX=&GM_YGT=&GM_YLT=&GMZ_MNMX=&GM_ZGT=&GM_ZLT=&GMLAT_MNMX=&GM_LATGT=&GM_LATLT=&GMLON_MNMX=&GM_LONGT=&GM_LONLT=&GMLT_MNMX=&GM_LTGT=&GM_LTLT=&GSE_APPLY_FILTER=&GSEX_MNMX=&GSE_XGT=&GSE_XLT=&GSEY_MNMX=&GSE_YGT=&GSE_YLT=&GSEZ_MNMX=&GSE_ZGT=&GSE_ZLT=&GSELAT_MNMX=&GSE_LATGT=&GSE_LATLT=&GSELON_MNMX=&GSE_LONGT=&GSE_LONLT=&GSELT_MNMX=&GSE_LTGT=&GSE_LTLT=&GSM_APPLY_FILTER=&GSMX_MNMX=&GSM_XGT=&GSM_XLT=&GSMY_MNMX=&GSM_YGT=&GSM_YLT=&GSMZ_MNMX=&GSM_ZGT=&GSM_ZLT=&GSMLAT_MNMX=&GSM_LATGT=&GSM_LATLT=&GSMLON_MNMX=&GSM_LONGT=&GSM_LONLT=&GSMLT_MNMX=&GSM_LTGT=&GSM_LTLT=&SM_APPLY_FILTER=&SMX_MNMX=&SM_XGT=&SM_XLT=&SMY_MNMX=&SM_YGT=&SM_YLT=&SMZ_MNMX=&SM_ZGT=&SM_ZLT=&SMLAT_MNMX=&SM_LATGT=&SM_LATLT=&SMLON_MNMX=&SM_LONGT=&SM_LONLT=&SMLT_MNMX=&SM_LTGT=&SM_LTLT=&OTHER_FILTER_DIST_UNITS=1&RD_APPLY=&FS_APPLY=&NS_APPLY=&BS_APPLY=&MG_APPLY=&LV_APPLY=&IL_APPLY=&REG_FLTR_SWITCH=&SCR_APPLY=&SCR=&RTR_APPLY=&RTR=&BTR_APPLY=&NBTR=&SBTR=&EXTERNAL=3&EXT_T1989c=1&KP_LONG_89=4&INTERNAL=1&ALTITUDE=100&DAY=1&TIME=3&DISTANCE=1&DIST_DEC=2&DEG=1&DEG_DEC=2&DEG_DIR=1&OUTPUT_CDF=1&LINES_PAGE=1&RNG_FLTR_METHOD=&PREV_SECTION=SCS&SSC=LOCATOR_GENERAL&SUBMIT=Submit+query+and+wait+for+output&.cgifields=SPCR"
	]
]

var memLock = {};

app.use(express.bodyParser());
// set default content-type to "text"
app.use(function(req, res, next){
	res.contentType("text");
	next();
})

// create cache dir if not exist
try{
	fs.statSync(__dirname+"/cache");
}catch(err){
	fs.mkdirSync(__dirname+"/cache");
};

app.use("/cache", express.static(__dirname + "/cache"));
app.use("/cache", express.directory(__dirname+"/cache"));
// app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));

app.get('/', function(req, res){
	res.contentType("html");
	res.send(renderIndex({
		source: [],
		resultText: "",
		forceUpdate: false
	}))
})

app.post('/', function(req, res, next){
	var source = [];
	var results = [];
	var resultText = "";
	var forceUpdate = false;

	source = req.body.source
			.trim()
			.split("\n")
			.filter(function(line){
				return line.trim()!="";
			});
	if(source.length==0){
		return res.redirect("back");
	}
	forceUpdate = req.body.forceUpdate;
	results = [];
	source.forEach(function(url){
		processUrl(url, results, forceUpdate, function(result){
			// when all urls are processed, make a http response
			if(results.length==source.length){
				resultText = results
				// restore urls' order
				.sort(function(a, b){
					return source.indexOf(a.url) - source.indexOf(b.url);
				})
				.map(function(d){
					if(d.error){
						return "URL: "+escapeHTML(d.url)+"<br><font color='red'>Error:"+d.error+"</font>";
					} else {
						var cacheUrl = "/cache/"+d.url.split("/")[2]+"/"+md5(d.url);
						return "URL: "+escapeHTML(d.url)
							 + (d.isFromCache ? "<br><font color='orange'>Found in cache.</font>" : "")
							+"<br>Time: <font color='green'>"+d.time + "ms</font>"
							+"<br> md5: "+d.md5
							+"<br> File: <a href='"+ cacheUrl+".data'>data</a> | <a href='"
							+cacheUrl+".out'> response </a>  | <a href='"
							+cacheUrl+".header'> header </a> | <a href='"
							+cacheUrl + ".log'> log </a>"
							// +"<br>Header: "+JSON.stringify(d.header)
							// +"<br>date: "+formatTime(d.date)
							// +"<br>data:<pre>"+d.data+"</pre>";
					}
				}).join('<br><br>');
				// res.redirect("back");
				res.contentType("html");
				res.send(renderIndex({
					source: source,
					resultText: resultText,
					forceUpdate: forceUpdate
				}))
			}
		});
	});
})

app.listen(8000);

function renderIndex(context){
	var index  = "<html><script type='text/javascript' src='https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js'></script><script>var presets ="
		+JSON.stringify(presets)
		+"</script><body><form action='/' method='post'><p>Urls: (Presets: <a href='#' onclick='$(urls).val(presets[0].join(\"\\n\\n\"));'>CDAWeb</a> <a href='#' onclick='$(urls).val(presets[1].join(\"\\n\\n\"));'>supermag</a> <a href='#' onclick='$(urls).val(presets[2].join(\"\\n\\n\"));'>sscweb</a>)</p><p><textarea id='urls' rows='30' cols='100' name='source'>" +
		escapeHTML(context.source.join("\n\n")) +
		"</textarea></p><p> <input type='submit'/> <input type='checkbox' name='forceUpdate' value='true' "+ (context.forceUpdate ? "checked" : "")+"> Ignore cache (<a href='cache'>Click here to browse current cache</a>)</p></form><p>Result:</p><p>" + 
		context.resultText +
		"</p></body></html>";
	return index;
};

function processUrl(url, results, forceUpdate, callback){
	var result = newResult(url);
	console.log("###", forceUpdate, isCached(url));

	if(!forceUpdate && isCached(url)){
		result.isFromCache = true;
		results.push(result);
		callback(result);
	} else {
		getDataUrl(url, function(err, url2){
			if(err){
				result.error = "Error getting data url";
				results.push(result);
				callback(result);
			} else {
				var start = +new Date();
	    		request.get({uri:url2}, function(error, response, body){
	    			if(error || response.statusCode!==200){
	    				result.error = "Can't fetch data";
	    				results.push(result);
	    				callback(result);
	    			} else {
	    				var end = +new Date();
	    				result.time = (end -start);
	    				result.body = body;
	    				result.data = getData(url, body);
	    				result.md5 =  md5(result.data);
	    				result.header = response.headers;
	    				results.push(result);
	    				writeCache(result);
	    				callback(result);
	    			}
	    		})
			}
		})
	}
}

function getData(url, doc){
	var re;
	switch(url.split("/")[2].toLowerCase()){
	case "cdaweb.gsfc.nasa.gov": 
		re = /^([\d-]+)\s+([\d:\.]+)\s+([\d\.]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
		break;
	case "sscweb.gsfc.nasa.gov":
		re = /^([\d]+)\s+([\d]+)\s+([\d:]+)\s+([+-\.\d]+)\s+([+-\.\d]+)\s+([+-\.\d]+)$/;
		break;
	case "supermag.uib.no":
		re = /^([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)\s+([\d]+)$|^BRW\s+([\d-]+)\s([\d-]+)\s([\d-]+)$/;
		break;
	default:
		re = /.*/;
	}
	return doc.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");
}

function getDataUrl(url, callback){ 	//callback(err, url)
	if(url.split("/")[2].toLowerCase()==="cdaweb.gsfc.nasa.gov"){
		request.get({uri: url}, function(error, response, body) {
			if(error || response.statusCode!==200) {
				callback(true, undefined);
			} else {
				parser.parseString(body, function(err, res){
					if(err || !res.FileDescription || !res.FileDescription.Name){
						callback(true, undefined);
					} else{
						callback(false, res.FileDescription.Name);
					}
				});
			}
		});
	} else {
		callback(false, url);
	}
}

function isCached(url){
	var directory =  __dirname + "/cache/" + url.split("/")[2];
	try{
		return fs.statSync(directory + "/" + md5(url)+".log");
	} catch(err){
		return false;
	}
}

// Sync version
// function writeCache(result){
// 	var directory =  __dirname + "/cache/" + result.url.split("/")[2];
// 	var filename = directory + "/" + md5(result.url);
// 	// create dir if not exist
// 	try{
// 		fs.statSync(directory);
// 	}catch(err){
// 		fs.mkdirSync(directory);
// 	};
// 	try{
// 		if(!result.isFromCache) {
// 			fs.writeFileSync(filename+".data", result.data);
// 			fs.writeFileSync(filename+".out", result.body);
// 			fs.writeFileSync(filename+".header", JSON.stringify(result.header));
// 			fs.writeFileSync(filename+".md5", result.md5);
// 		}
// 		fs.appendFile(filename+".log", 
// 			formatTime(result.date) + "\t"+result.time+"\t"+result.md5+"\n");
// 	}catch(error){
// 		result.error ="Can't write to cache";
// 		console.error(error);
// 	}
// }

// Async version
function writeCache(result){
	var directory =  __dirname + "/cache/" + result.url.split("/")[2];
	var filename = directory + "/" + md5(result.url);
	var header = [];
	for(var key in result.header){
		header.push(key + " : " + result.header[key]);
	}
	console.log("@@@", memLock[result.url]);
	if(!memLock[result.url]) {
		// if memLock[result.url] is undefine or 0, no writting is on-going
		memLock[result.url] = 4;

		// create dir if not exist
		fs.exists(directory, function(exist){
			if(!exist){
				fs.mkdir(directory, function(err){
					if(err){
						console.error(err);
					} else {
						writeCacheFiles();
					}
				});
			} else{
				writeCacheFiles();
			}
			
		});	
	}

	function writeCacheFiles(){

		fs.writeFile(filename+".data", result.data, finish);
		fs.writeFile(filename+".header", header.join("\n"), finish);
		fs.writeFile(filename+".out", result.body);
		fs.writeFile(filename+".md5", result.md5, finish);
		fs.appendFile(filename+".log", 
			formatTime(result.date) + "\t"+result.time+"\t"+result.md5+"\n",
			finish
		);
	}

	function finish(err){
		if(err){
			console.log("Error occured when writing cache!: "+err);
			console.trace(err);
		}
		memLock[result.url]--;
	}
}

function formatTime(date){
	if(!date){
		return;
	}
	return [date.getFullYear(),
		pad(date.getMonth()+1,2),
		pad(date.getDate(), 2),
		pad(date.getHours(), 2),
		pad(date.getMinutes(), 2),
		pad(date.getSeconds(), 2),
		pad(date.getMilliseconds(), 3)
	].join(" ");

	function pad(str, num){
		// convert to string
		str = str+"";
		while(str.length < num) {
			str = "0"+str;
		}
		return str;
	}
}

// construct a result object with default values
function newResult(url){
	return {
		url : url,
		md5 : "",
		data : "",
		header : "",
		date : new Date(),
		time : 0,
		isFromCache : false,
		error : false
	}
}

function md5(str){
	return crypto.createHash("md5").update(str).digest("hex");
}

function escapeHTML(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
}