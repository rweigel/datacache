exports.name = "swpcKpAp2Day";
//var moment = require("moment");
exports.match = function(url){
	return url.split("/")[2].toLowerCase()==="xwdc.kugi.kyoto-u.ac.jp";
}

exports.extractData = function(data0){

	 
	//var stations = ["Boulder","Chambon-la-fore","College","Fredericksburg","Kergulen Island","Learmonth","Planetary","Wingst"];
	//console.log(stations.length)
	var stations = ["Beijing","Belsk","Boulder","Cape Chelyuskin","Chambon-la-foret","College","Dixon Island","Fredericksburg","Gottingen","Kergulen Island","Krenkel","Learmonth","St. Petersburg","Magadan","Moscow","Murmansk","Novosibirsk","P. Tunguska","Petropavlovsk","Planetary","Tiksi Bay","Wingst"];
	//console.log(stations.length)
	
	var Ap = [];
	var K  = [];
	
	var A = "";
	var YR = [];
	var MODY = [];

	var stations_available = [];
	var J = 0;
	data0 = data0.toString().split("\n");
	//var data = $(".data").text().split("\n");
	for (var j = 0;j < stations.length;j++) {
		var re = new RegExp("^[0-9]|"+stations[j]);
		data   = data0.filter(function(line){return line.search(re)!=-1;});
		
		if (data[1].match(/^[0-9]/)) {
			continue;
		}
		for (var k = 0;k < data.length;k=k+2) {
			var z = Math.round(k/2);
			
			if (typeof(Ap[z]) === 'undefined') {
				Ap[z] = [];
				K[z] = [];
			}
			
			YR[z]     = data[k].substring(0,4);
			MODY[z]   = data[k]
			                 .replace(/ ([0-9])$/," 0$1")
			                 .replace(/ Jan (.*)/,'-01-$1')
			                 .replace(/ Feb (.*)/,'-02-$1')
			                 .replace(/ Mar (.*)/,'-03-$1')
			                 .replace(/ Apr (.*)/,'-04-$1')
			                 .replace(/ May (.*)/,'-05-$1')
			                 .replace(/ Jun (.*)/,'-06-$1')
			                 .replace(/ Jul (.*)/,'-07-$1')
			                 .replace(/ Aug (.*)/,'-08-$1')
			                 .replace(/ Sep (.*)/,'-09-$1')
			                 .replace(/ Oct (.*)/,'-10-$1')
			                 .replace(/ Nov (.*)/,'-11-$1')
			                 .replace(/ Dec (.*)/,'-12-$1')
			                 .replace(/\-([1-9]$)/,"-0$1");

			A        = data[k+1].substring(25,30);
			Ap[z][J] =  (A+A+A+A+A+A+A+A).trim().split(/\s+/);		
			K[z][J]  = data[k+1].substring(31).trim().split(/\s+/);
		}
		stations_available[J] = stations[j];
		J = J+1;

	}
	
	//console.log(stations_available.length)
	if ((stations_available.length != 8) && (stations_available.length != 22)) {
		console.log("Wrong number of stations found in file.");
		return "\n";
	}
		

	var line = "";
	for (var k = 0;k < Ap.length;k++) {
		line = line + MODY[k] + " 01:30 ";
		for (i = 0;i < 8;i++) {
			for (j = 0;j < stations_available.length;j++) {
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

