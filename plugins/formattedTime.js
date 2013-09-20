var moment = require('moment');

exports.extractLine = function (line, req) {
		
		var timeformat  = req.query.timeformat || req.body.timeformat || "";
		var timecols    = req.query.timecols   || req.body.timecols || "";

		var timeformata = timeformat.split(" ");
		var timecolsa   = timecols.split(",");
	
		// Assumes time is in continuous columns and before any data column that is to be kept.
		timev      = line.split(" ").slice(parseInt(timecolsa[0])-1,parseInt(timecolsa[timecolsa.length-1]));
		datav      = line.split(" ").slice(parseInt(timecolsa[timecolsa.length-1]));
	
		console.log(timeformata)
		console.log(timev.join(" "))
		console.log(datav);
		d = moment(timev.join(" "),timeformat);
		console.log(d)
		
		d = moment(timev.join(" "),timeformat)._a;
		d[1] = ((""+d[1]).length == 1) ? "0"+(d[1]+1) : (d[1]+1);
		d[2] = ((""+d[2]).length == 1) ? "0"+d[2] : d[2];
		d[3] = ((""+d[3]).length == 1) ? "0"+d[3] : d[3];
		d[4] = ((""+d[4]).length == 1) ? "0"+d[4] : d[4];
		d[5] = ((""+d[5]).length == 1) ? "0"+d[5] : d[5];
		d[6] = ((""+d[6]).length == 1) ? "00"+d[6] : d[6];
		d[6] = ((""+d[6]).length == 2) ? "0"+d[6] : d[6];
	
		console.log(d)
		var timestamp = d[0]+"-"+d[1]+"-"+d[2]+"T"+d[3]+":"+d[4]+":"+d[5]+"."+d[6]+"Z";

		return timestamp + " " + datav.join(" ");
}
