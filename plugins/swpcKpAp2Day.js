exports.name = "swpcKpAp2Day";
//var moment = require("moment");
exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="xwdc.kugi.kyoto-u.ac.jp";
}

exports.extractData = function(data0){

	var stations = ["Boulder","Chambon-la-fore","College","Fredericksburg","Kergulen Island","Learmonth","Planetary","Wingst"];
	
	var Ap = [];
	Ap[0] = [];
	Ap[1] = [];
	var K  = [];
	K[0] = [];
	K[1] = [];
	
	var A = "";
	var YR = [];
	var MODY = [];

	data0 = data0.toString().split("\n");
	//var data = $(".data").text().split("\n");
	for (var j = 0;j < stations.length;j++) {
		var re = new RegExp("^[0-9]|"+stations[j]); 
		data   = data0.filter(function(line){return line.search(re)!=-1;});
		
		YR[0]     = data[0].substring(0,4);
		MODY[0]   = data[0].replace(/ ([0-9])$/," 0$1").replace(/ Aug (.*)/,'-08-$1').replace(/\-([1-9]$)/,"-0$1");
		A         = data[1].substring(25,30);
		Ap[0][j] =  (A+A+A+A+A+A+A+A).trim().split(/\s+/);
	
		K[0][j]  = data[1].substring(31).trim().split(/\s+/);
		
		YR[1]    = data[2].substring(0,4);
		MODY[1]  = data[2].replace(/ ([0-9])$/," 0$1").replace(/ Aug (.*)/,'-08-$1').replace(/\-([1-9]$)/,"-0$1");
		A        = data[3].substring(25,30);
		Ap[1][j] =  (A+A+A+A+A+A+A+A).trim().split(/\s+/);
		K[1][j]  = data[3].substring(31).trim().split(/\s+/);
	}

	var line = "";
	for (var k = 0;k < Ap.length;k++) {
		line = line + MODY[k] + " 01:30 ";
		for (i = 0;i < 8;i++) {
			for (j = 0;j < stations.length;j++) {
				line = line + " " + K[k][j][i] + " " + Ap[k][j][i];			
			}
			if (i < 7) { 
				line = line + "\n" + MODY[k] + " " + (((i+1)*3+1)+"").replace(/^([0-9])$/,"0$1") + ":30 ";
			} else {
				line = line + "\n";
			}
		}
	}
		
	return line
	
};

