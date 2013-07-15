var assert = require("assert"),
	Timer = require("./util").Timer;
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

	runner.suite = function(msg, run){
		Timer.start(msg);
		var activeSuite = {
			name: msg,
			passedTestsCount: 0,
			failedTestsCount: 0,
			tests: [],
			info: {}
		};
		results.suites.push(activeSuite);

		run(test, testInfo, finish);
		
		function finish(){
			if(activeSuite.error){
				results.failedSuitesCount++;
			} else {
				results.passedSuitesCount++;
			}
			activeSuite.duration = Timer.stop(msg);
		};

		/*
			test() is the wrapper function for assertions, so that all assertion failures are captured and 
			saved into runner.results. 
		*/
		function test(msg, run){
			Timer.start(msg);
			var activeTest = {
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
					activeTest.actual = "" + e.actual;
					activeTest.expected = "" + e.expected;
				} else {
					activeTest.message = "Error: " + e;
				}
			}
		};

		/*
			testInfo() is used to add extra info to results.
		*/
		function testInfo(name, value){
			activeSuite.info[name] = value;
		};
	};


	/*
		Helper function to check condition is false 
	*/
	runner.assertNot = function(condition, message){
		assert(!condition, message);
	}

	return runner;
}

