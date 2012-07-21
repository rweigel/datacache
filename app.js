var request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	express = require('express'),
	app = express.createServer();

var defaultSource =  ["http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050101T000000Z,20050102T000000Z/Magnitude,BGSEc?format=text",
"http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050102T000000Z,20050103T000000Z/Magnitude,BGSEc?format=text",
"http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050103T000000Z,20050104T000000Z/Magnitude,BGSEc?format=text"
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050104T000000Z,20050105T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050105T000000Z,20050106T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050106T000000Z,20050107T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050107T000000Z,20050108T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050108T000000Z,20050109T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050109T000000Z,20050110T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050110T000000Z,20050111T000000Z/Magnitude,BGSEc?format=text",
// "http://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets/AC_H1_MFI/data/20050111T000000Z,20050112T000000Z/Magnitude,BGSEc?format=text"
];

function process(source, res){
	var result = [];
	source.forEach(function(url){
		processUrl(url, function(){
			console.log(result);
			
			// check whether all async jobs have finished
			if (result.length === source.length){
				sendResult(result,res);
			}
		});
	})
	return;

	function processUrl(url, callback){
		request.get({uri: url}, function(error, response, body) {
			var start = +new Date();
		    if (response && response.statusCode !== 200 || !body) {
		    	//TODO: handle errors
		    	result.push({"url" : url, "time" : "error"+response, "response" : body});
		    	callback();
		    } else {
		    	parser.parseString(body, function(err, res){
		    		if(err){
		    			result.push({"url": url, "time":"error", "error": err})
		    		} else{
		    			var url2 = res.FileDescription.Name;
			    		request.get({uri:url2}, function(error, response, body){
			    			var end = +new Date();
			    			result.push({"url" : url, "time" : (end - start)});
			    			callback();
			    		})
			    	}
		    	});
		    }
		});
	}

	function sendResult(){
		res.contentType("text");
		res.send(result.map(function(d){
			return "URL: "+d.url+"\n"+"time: "+d.time + "ms";
		}).join('\n\n\n'));
	}
}

app.use(express.bodyParser());

app.get('/', function(req, res){
	process(defaultSource, res);
})
app.post('/', function(req, res){
	process(parseSource(req.body.source), res);
})

function parseSource(source){
	return source.trim().split("\n");
}

app.listen(9000);