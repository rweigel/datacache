var fs = require("fs"),
	handlebars = require("handlebars");

var simpleTemplate = fs.readFileSync(__dirname + "/simple.template", {encoding: "utf8"});

function simpleReporter(results){
	return handlebars.compile(simpleTemplate)(results);
}

exports.simpleReporter = simpleReporter;
