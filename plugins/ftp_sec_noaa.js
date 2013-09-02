var FtpClient  = require("ftp"),
	util = require("../util");


exports.name = "noaa";

exports.match = function(url){
    //console.log(url);
    //console.log(typeof url);
    return url.split("/")[2].toLowerCase()==="ftp.sec.noaa.gov";
}

exports.process = function(work, callback){
	var conn = new FtpClient();
	conn.on("ready", function(){
		conn.get(work.url.split("/").slice(3).join("/"), function(err, stream){
			if(err){
				callback(true, work);
			} else{
				var buff = "";
				stream.on("data", function(data){
					if(!work.responseTime) {
					    //work.responseTime = new Date();
					}
					buff+=data.toString();
				})
			    .on("error", function(e){work.error=e;callback(true, work);conn.end();})
				.on("end", function(){
					work.body = buff;
					work.data = work.extractData(work.body);
					work.dataMd5 =  util.md5(work.data);
					work.header = "";
					util.writeCache(work, function(){
						callback(false, work);
					});
				});
			}
		});
	})
	.on("error", function(e){work.error=e;callback(true, work);conn.end();})
	.connect({host: work.url.split("/")[2]});
}

exports.extractData = function(data){
	var re = /^[\d\s\.e-]+$/;
	return data.toString()
			.split("\n")
			.filter(function(line){
				return line.search(re)!=-1;
			})
			.join("\n");;
}