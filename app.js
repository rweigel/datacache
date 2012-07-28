var request = require("request"),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	express = require('express'),
	app = express.createServer();

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

var result = [];

app.use(express.bodyParser());
// app.use(function(err, req, res, next){
// 	//error handler
// 	res.send(err, 500);
// })

app.get('/', function(req, res){
	res.send("<html><body><form action='/'' method='post'><p>Urls: </p><p><textarea rows='30' cols='100' name='source'>" +
		source.join("\n") +
		"</textarea></p><p> <input type='submit'/></p></form><p>Result:</p><p>" + 
		result +
		"</p></body></html>");
})
app.post('/', function(req, res){
	source = req.body.source.trim().split("\n");
	result = [];
	source.forEach(function(url){
		request.get({uri: url}, function(error, response, body) {
			if(error || response.statusCode!==200) {
				result.push({error : true, url : url});
				checkAndRespond();
			} else {
				var start = +new Date();
		    	parser.parseString(body, function(err, res){
		    		if(err){
		    			result.push({url: url, error: true});
		    			checkAndRespond();
		    		} else{
		    			if(!res.FileDescription || !res.FileDescription.Name){
		    				result.push({url: url, error: true});
		    				checkAndRespond();
		    			} else {
		    				var url2 = res.FileDescription.Name;
				    		request.get({uri:url2}, function(error, response, body){
				    			if(error || response.statusCode!==200){
				    				result.push({error : true, url : url2});
				    				checkAndRespond();
				    			} else {
				    				var end = +new Date();
				    				result.push({"url" : url, "time" : (end - start)});
				    				checkAndRespond();
				    			}
				    		})
		    			}
			    	}
		    	});
		    }
		})
	})
	
	function checkAndRespond(){
		if(result.length==source.length){
			result = result
			// restore urls' order
			.sort(function(a, b){
				return source.indexOf(a.url) - source.indexOf(b.url);
			})
			.map(function(d){
				if(d.error){
					return "URL: "+d.url+"<br><font color='red'>Error!</font>";
				} else {
					return "URL: "+d.url+"<br>Time: <font color='green'>"+d.time + "ms</font>";
				}
			}).join('<br><br>');
			res.redirect("back");
		}
	}
})

app.listen(9000);