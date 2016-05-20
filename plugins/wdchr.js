exports.name = "wdchr";

exports.extractData = function (data, options) {

	var dataa = data.toString().split("\n");
	//dataa = data.split("\n");
	var N = dataa.length;
	var Data = {};
	//var startdate = options.timeRangeExpanded.split("/")[0];
	//var stopdate  = options.timeRangeExpanded.split("/")[1];
	//console.log(options)
	//var startms = new Date(startdate).getTime();
	//var stopms  = new Date(stopdate).getTime();
	for (var i = 0;i < N;i++) {
		if (dataa[i] === "") {
			break;
		}
		year    = dataa[i].substring(3,5);
		month   = dataa[i].substring(5,7).replace(/ ([0-9])/,'0$1')
		element = dataa[i][7].toUpperCase();
		// In case " 1" listed instead of "01"
		day     = dataa[i].substring(8,10).replace(/ ([0-9])/,'0$1'); 
		QorD    = dataa[i][14]; // Quiet (1) or Disturbed (2)
		
		if (1) {
			yrbase  = dataa[i][15];
			//console.log("Year base = " + yrbase)
		    if (yrbase === "0") {
		    	yrbase = "20";
		    } else if (yrbase === "8") {
		    	yrbase = "18"
		    } else {
		    	yrbase = stopdate.substring(0,2);
		    }
		}
		//console.log("Year base = " + yrbase)
		if (QorD === "Q") {
			QorD = 1;
		}
		if (QorD === "D") {
			QorD = 2;
		}
		if (QorD === "") {
			QorD = "9999";
		}
		tabularbase = 100*parseInt(dataa[i].substring(16,20))
	    hrvals = dataa[i].substring(20,116);
		for (var j = 0; j < 24;j++) {
		  hr = "" + j;
		  if (j < 10) {hr = "0" + j}
		  var tmps = hrvals.substring(4*j,4*(j+1))
		  if (tmps !== "9999") {
		  	val = tabularbase + parseInt(tmps);
		  } else {
		  	val = 999999;
		  }
		  time = yrbase + year + "-" + month + "-" + day + "T" + hr + ":00:00.000"
		  //console.log(time)
		  ms = new Date(time).getTime();
		  //if (ms >= startms && ms <= stopms) {
		  	line =  time + " " + val;
		  //}
			if (typeof(Data[time]) === "undefined") {
				Data[time] = {};
			}
		  //console.log(line)
	      Data[time][element] = val;
		}
	}
	line = ""
	//console.log(Data)
	for (key in Data) {
		line += key + " "
		P = ["X","Y","Z","F","H","D","I"]; 
		for (var p=0;p < P.length;p++) {
			line += (Data[key][P[p]] || 999999) + " "
		}
		line += "\n"
	}	return line
};

