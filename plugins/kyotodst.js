exports.name = "kyotodst";
//var moment = require("moment");
exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="xwdc.kugi.kyoto-u.ac.jp";
}

exports.extractData = function(data){

	
	//console.log(typeof data)
	var monthyear = data.toString().split("\n").filter(function(line){return line.search(/JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER/)!=-1;})[0].replace(/\s/g,"");
	var yearmonth = monthyear.replace(/(.*)([0-9][0-9][0-9][0-9])/,"$2-$1-01 00:30:00.00000Z")
					.replace("JANUARY","01")
					.replace("FEBRUARY","02")
					.replace("MARCH","03")
					.replace("APRIL","04")
					.replace("MAY","05")
					.replace("JUNE","06")
					.replace("JULY","07")
					.replace("AUGUST","08")
					.replace("SEPTEMBER","09")
					.replace("OCTOBER","10")
					.replace("NOVEMBER","11")
					.replace("DECEMBER","12");

	var time = new Date(yearmonth);
	var i = 0;
	var data = data.toString().split("\n").filter(function(line){return line.search(/^[0-9]|^ [0-9]/)!=-1;}).join("\n").replace(/^ [0-9]|\n [0-9]|\n[0-9][0-9]/g,'').replace(/9999/g," 9999");
	var result = data
		.trim()
		.split(/\s+/)
		.map(function(number){
			time = add60min(time);
			return time.toISOString().replace(/T/," ").replace(/Z/,"") + " " + number;
		});

	function add60min(date){
		//console.log(date);
		md = new Date(date.getTime() + 60*60000*i);
		i = 1;
		return md
		
	}

	return result.join("\n");
};

