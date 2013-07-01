var assert = require("assert");
module.exports = runner;

/*
	Factory method to create a new test runner
*/
function runner(){
	var runner = {};

	/*
		results is a tree-like structure which holds testing results
	*/
	var results = {
		passedSuitesCount: 0,
		failedSuitesCount: 0,
		suites: []
	};
	runner.results = results;

	var activeSuite, activeTest;

	runner.suite = function(msg, run){
		Timer.start(msg);
		activeSuite = {
			name: msg,
			passedTestsCount: 0,
			failedTestsCount: 0,
			tests: [],
			info: {}
		};
		results.suites.push(activeSuite);

		if(getFunctionParams(run).length > 0){	// Async style
			run(finish);
		} else {								// Sync style
			run();
			finish();
		}
		
		function finish(){
			if(activeSuite.error){
				results.failedSuitesCount++;
			} else {
				results.passedSuitesCount++;
			}
			activeSuite.duration = Timer.stop(msg);
		};
	};

	/*
		test() is the wrapper function for assertions, so that all assertion failures are captured and 
		saved into runner.results. 
	*/
	runner.test = function(msg, run){
		Timer.start(msg);
		activeTest = {
			name: msg
		};
		activeSuite.tests.push(activeTest);
		try {
			run();
			activeSuite.passedTestsCount++;
			activeTest.duration = Timer.stop(msg);
		} catch(e) {
			activeTest.duration = Timer.stop(msg);
			activeTest.error = true;
			activeSuite.error = true;
			activeSuite.failedTestsCount++;
			if(e.name == "AssertionError"){
				activeTest.message = e.message;
				activeTest.actual = e.actual;
				activeTest.expected = e.expected;
			} else {
				activeTest.message = "Unexpected error occurred: " + e.name + ":" + e.messagse;
			}
		}
	};

	/*
		testInfo() is used to add extra info to results.
	*/
	runner.testInfo = function(name, value){
		activeSuite.info[name] = value;
	};

	/*
		Helper function to check condition is false 
	*/
	runner.assertNot = function(condition, message){
		assert(!condition, message);
	}

	return runner;
}

/*
	Get the parameters in a function's definition
*/
function getFunctionParams(func){
	var funStr = func.toString();
    return funStr.slice(funStr.indexOf('(')+1, funStr.indexOf(')')).match(/([^\s,]+)/g);
}

var Timer = {
	startTimes: {},

	start: function(tag){
		tag = tag || "__default";
		this.startTimes[tag] = new Date;
	},

	stop: function(tag){
		tag = tag || "__default";
		return (new Date) - this.startTimes[tag];
	}
};