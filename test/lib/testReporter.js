var fs = require("fs"),
	handlebars = require("handlebars");

var simpleTemplate = fs.readFileSync(__dirname + "/simple.template").toString("utf8");

function simpleReporter(results){
	return handlebars
			.compile(simpleTemplate)(results)
			.replace(/\r\n|\r|\n/g, "")
			.replace(/\\n/g, "\n");
}

exports.simpleReporter = simpleReporter;
