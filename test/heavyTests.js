var logger = require("./lib/logger")();

module.exports = function(finish){
	logger.i("heavy tests started");

	finish = finish || function(){};

	finish();
}