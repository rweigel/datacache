var moment = require('moment')
var log    = require('../log.js')
var formattedTime = require('../plugins/formattedTime.js').formatLine;
var clc     = require('cli-color')
function logc(str,color) {var msg = clc.xterm(color); console.log(msg(str))}

var options = {}
options.streamFilterReadTimeFormat  = "$Y,$j"
options.streamFilterReadTimeColumns = "1,2"
options.streamFilterWriteTimeFormat = "1";
options.logsig                      = "1";
options.streamFilterReadTimeStart   = "2000-01-01"
options.streamFilterReadTimeStop    = "2000-01-02"
options.streamFilterWriteDelimiter  = ","
options.streamFilterReadColumnsDelimiter = ","

line = []
i = -1;
line[i++] = "$Y,$j/1,2/2000,1.5,-1,-2,-3,-4/2000-01-01T12:00:00.000Z,-1,-2,-3,-4"
line[i++] = "$Y,$j/1,2/2000,1.5,-1,-2,-3,-4/2000-01-01T12:00:00.000Z,-1,-2,-3,-4"
line[i++] = "$Y,$j/1,2/2000,1.51,-1,-2,-3,-4/2000-01-01T12:14:24.000Z,-1,-2,-3,-4"
line[i++] = "$Y,$j/1,2/2000,1.511,-1,-2,-3,-4/2000-01-01T12:15:50.400Z,-1,-2,-3,-4"

line[i++] = "$Y,$j,$H/1,2,3/2000,1,12,-1,-2,-3,-4/2000-01-01T12:00:00.000Z,-1,-2,-3,-4"
line[i++] = "$Y,$j,$H/1,2,3/2000,1,12.1,-1,-2,-3,-4/2000-01-01T12:06:00.000Z,-1,-2,-3,-4"
line[i++] = "$Y,$j,$H/1,2,3/2000,1,23.99,-1,-2,-3,-4/2000-01-01T23:59:24.000Z,-1,-2,-3,-4"

line[i++] = "$Y,$j,$M/1,2,3/2000,1,720,-1,-2,-3,-4/2000-01-01T12:00:00.000Z,-1,-2,-3,-4"
line[i++] = "$Y,$j,$M/1,2,3/2000,1,721,-1,-2,-3,-4/2000-01-01T12:01:00.000Z,-1,-2,-3,-4"
line[i++] = "$Y,$j,$M/1,2,3/2000,1,720.5,-1,-2,-3,-4/2000-01-01T12:00:30.000Z,-1,-2,-3,-4"
line[i++] = "$Y,$j,$M/1,2,3/2000,1,720.51,-1,-2,-3,-4/2000-01-01T12:00:30.600Z,-1,-2,-3,-4"
line[i++] = "$Y,$j,$S/1,2,3/2000,1,43200,-1,-2,-3,-4/2000-01-01T12:00:00.000Z,-1,-2,-3,-4"

Npass = 0;
for (var i = 0;i < line.length; i++) {
	options.streamFilterReadTimeFormat = line[i].split("/")[0]
	options.streamFilterReadTimeColumns = line[i].split("/")[1]
	outo = formattedTime(line[i].split("/")[2],options,true)
	oute = line[i].split("/")[3]
	outoms = (new Date(outo.split(",")[0])).getTime();
	outems = (new Date(oute.split(",")[0])).getTime();
	if (outems == outoms) {
		//console.log("PASS+")
		Npass = Npass + 1;
	} else if (Math.abs(outoms-outems) <=1) {
		log.logc("formattedTimeTest.js: Output:   " + outo, 9);
		log.logc("formattedTimeTest.js: Expected: " + oute, 9);
		log.logc("formattedTimeTest.js: FAIL (roundoff)", 9);
	} else {
		log.logc("formattedTimeTest.js: Output:   " + outo, 9);
		log.logc("formattedTimeTest.js: Expected: " + oute, 9);
		log.logc("formattedTimeTest.js: FAIL", 9);
	}
}
if (Npass == line.length) {
	console.log("All formattedTime tests passed.")
	process.exit(0);
} else {
	console.log("All formattedTime tests passed.")
	process.exit(1);
}