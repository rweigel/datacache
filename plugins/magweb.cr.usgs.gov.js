exports.name = "magweb.cr.usgs.gov";

exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="magweb.cr.usgs.gov";
}

exports.extractData = function (body, options) {
	lineRegExp = options.lineRegExp;
	return body.toString().replace(/([0-9])\-/g,"$1 ").replace(/:/g," ").split("\n").filter(function(line){return line.search(lineRegExp)!=-1;}).join("\n") + "\n"	
}

