var util = require("../util.js"),
	scheduler = require("../scheduler");

exports.match = function(url){
	return url.split("?")[0].toLowerCase()==="http://aurora.gmu.edu/lsremote/cgi-bin/lsremote.cgi";
}

exports.preprocess = function(work, callback){
	util.get(work.url, function(error, response, body) {
		if(error || response.statusCode!==200) {
			callback(true, work);
		} else {
			var list=[];
			var urls=[];
			try{
				(function(){
					eval(body.toString());
					list = imagelist();
					urls = listToUrls(work.url, list);
					scheduler.addURLs(urls, work.options);
				})();
				callback(false, work);
			} catch(err){
				console.log(err);
				callback(true, work);
			}
		}
	})
};

exports.process = function(work, callback){
	// do nothing
	callback(false, work);
}

exports.extractData = function(data){
	return "";
};

function listToUrls(url, list){
	var urlBase = require("url").parse(url, true)
					.query
					.path;
	return list.map(function(item){
		return urlBase + util.unescapeHTML(item[3].substring(2));
	});
}