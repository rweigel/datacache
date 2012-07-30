var request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	express = require('express'),
	app = express.createServer(),
	crypto = require("crypto"),
	fs = require("fs");

var source =  ["http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050101T000000Z,20050102T000000Z/Magnitude,BGSEc?format=text",
"http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050102T000000Z,20050103T000000Z/Magnitude,BGSEc?format=text",
"http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050103T000000Z,20050104T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050104T000000Z,20050105T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050105T000000Z,20050106T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050106T000000Z,20050107T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050107T000000Z,20050108T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050108T000000Z,20050109T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050109T000000Z,20050110T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050110T000000Z,20050111T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050111T000000Z,20050112T000000Z/Magnitude,BGSEc?format=text"
];

var results = [];
var resultText = "";
var forceUpdate = false;

app.use(express.bodyParser());
app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));

app.get('/', function(req, res){
	res.send("<html><body><form action='/'' method='post'><p>Urls: </p><p><textarea rows='30' cols='100' name='source'>" +
		source.join("\n") +
		"</textarea></p><p> <input type='submit'/> <input type='checkbox' name='forceUpdate' value='true' "+ (forceUpdate ? "checked" : "")+"> Update cache</p></form><p>Result:</p><p>" + 
		resultText +
		"</p></body></html>");
})
app.post('/', function(req, res, next){
	source = req.body.source.trim().split("\n");
	forceUpdate = req.body.forceUpdate;
	results = [];
	source.forEach(function(url){
		processUrl(url, results, function(result){
			// when all urls are processed, make a http response
			if(results.length==source.length){
				resultText = results
				// restore urls' order
				.sort(function(a, b){
					return source.indexOf(a.url) - source.indexOf(b.url);
				})
				.map(function(d){
					if(d.error){
						return "URL: "+d.url+"<br><font color='red'>Error:"+d.error+"</font>";
					} else {
						return "URL: "+d.url
							 + (d.fromCache ? "<br><font color='orange'>Found in cache.</font>" : "")
							+"<br>Time: <font color='green'>"+d.time + "ms</font>"
							+"<br> md5: "+d.md5
							// +"<br>Header: "+JSON.stringify(d.header)
							// +"<br>date: "+formatTime(d.date)
							// +"<br>data:<pre>"+d.data+"</pre>";
					}
				}).join('<br><br>');
				res.redirect("back");
			}
		});
	});
})

app.listen(8000);

function processUrl(url, results, callback){
	var result;
	if(!forceUpdate && isCached(url)){
		result = newResult(url);
		result.fromCache = true;
		results.push(result);
		writeCache(result);
		callback(result);
	} else {
		getDataUrl(url, function(err, url2){
			if(err){
				result = newResult(url);
				result.error = "Error getting data url";
				results.push(result);
				callback(result);
			} else {
				var start = +new Date();
	    		request.get({uri:url2}, function(error, response, body){
	    			if(error || response.statusCode!==200){
	    				result = newResult(url);
	    				result.error = "Can't fetch data";
	    				results.push(result);
	    				callback(result);
	    			} else {
	    				var end = +new Date();
	    				result = newResult(url);
	    				result.time = (end -start);
	    				result.md5 =  md5(body);
	    				result.data = body;
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

function isCached(url){
	// return false;
	try{
		return fs.statSync(__dirname + "/cache/" + md5(url)+".log");
	} catch(err){
		return false;
	}
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

// Sync version
function writeCache(result){
	var filename = __dirname + "/cache/" + md5(result.url);
	try{
		if(!result.fromCache) {
			fs.writeFileSync(filename+".data", result.data);
			fs.writeFileSync(filename+".header", JSON.stringify(result.header));
			fs.writeFileSync(filename+".md5", result.md5);
		}
		fs.appendFile(filename+".log", 
			formatTime(result.date) + "\t"+result.time+"\t"+result.md5+"\n");
	}catch(error){
		result.error ="Can't write to cache";
		console.error(error);
	}
}

// Async version
// function writeCacheAsync(result){
// 	var filename = __dirname + "/cache/" + encodeURIComponent(result.url);
// 	if(!result.fromCache) {
// 		fs.writeFile(filename+".data", result.data, log);
// 		fs.writeFile(filename+".header", JSON.stringify(result.header), log);
// 		fs.writeFile(filename+".md5", result.md5, log);
// 	}
// 	fs.appendFile(filename+".log", 
// 		formatTime(result.date) + "\t"+result.time+"\t"+result.md5+"\n");

// 	function log(err){
// 		if(err){
// 			console.log("Error occured when writing cache!");
// 		}
// 	}
// }

function formatTime(date){
	if(!date){
		return;
	}
	return [date.getFullYear(),
		(date.getMonth()+"").length==2 ? date.getMonth() : "0"+date.getMonth(),
		(date.getDate()+"").length==2 ? date.getDate() : "0"+date.getDate(),
		(date.getHours()+"").length==2 ? date.getHours() : "0"+date.getHours(),
		(date.getMinutes()+"").length==2 ? date.getMinutes() : "0"+date.getMinutes(),
		(date.getSeconds()+"").length==2 ? date.getSeconds() : "0"+date.getSeconds(),
		(date.getMilliseconds()+"").length==3 ? date.getMilliseconds() : 
			(date.getMilliseconds()+"").length==2 ? "0"+date.getMilliseconds() : "00"+date.getMilliseconds()
	].join(" ");
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
		fromCache : false,
		error : false
	}
}

function md5(str){
	return crypto.createHash("md5").update(str).digest("hex");
}