var logger = require("./lib/logger")();

module.exports = function(finish){
	logger.i("failed tests started");

	finish = finish || function(){};
	
	finish();
}