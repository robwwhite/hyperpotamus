var interpolate = require("../lib/interpolate");
var async = require("async");
var assert = require("assert");
var _ = require("lodash");
var validateVerror = require("./test_utils/validate_verror");

describe("String Interpolation", () => {

	var prefix = "PRE|", suffix = "|POST";

	describe("Normal Tokens", (done) => {
		var data = { token: "value" };
		var cases = [
			["<% token %>", "Whitespace both sides"],
			["<%token%>", "No whitespace"],
			["<%token %>", "Trailing whitespace"]
		];

		async.each(cases, (testcase, callback) => {
			it(testcase[1], () => {
				assert.equal("PRE|value|POST", interpolate("PRE|" + testcase[0] + "|POST", data));
				callback();
			});
		}, done);
	});

	describe("Url-Encode token", (done) => {
		var data = { token: "!@#$%^&*()-_=+\\|]}[{'\";:/?.>,<`~" };
		var encoded = encodeURIComponent(data.token);
		var cases = [
			[encoded, "<% token | urlencode %>", "Encode"],
			[encodeURIComponent(encoded), "<% token | urlencode | urlencode %>", "Encode encode"],
			[encoded, "<% token | urlencode | urlencode | urldecode %>", "Encode encode decode"],
			[data.token, "<% token | urlencode | urldecode %>", "Encode decode"],
		];

		async.each(cases, (testcase, callback) => {
			it(testcase[2], () => {
				assert.equal(prefix + testcase[0] + suffix, interpolate(prefix + testcase[1] + suffix, data));
				callback();
			});
		}, done);
	});

	describe("Optional token", (done) => {
		var data = {};
		var cases = [
			["", "<% token | optional %>", "Optional"],
			["default", "<% token | optional,default %>", "Option optional, default"],
		];

		async.each(cases, (testcase, callback) => {
			it(testcase[2], () => {
				assert.equal(prefix + testcase[0] + suffix, interpolate(prefix + testcase[1] + suffix, data));
				callback();
			});
		}, done);
	});

	describe("Format the date", (done) => {
		var moment = require("moment");
		var data = { the_date: moment() };

		var cases = [
			["<% the_date | date_format,YYYY-MM-DD %>", "date_format"]
		];

		async.each(cases, (testcase, callback) => {
			it(testcase[1], () => {
				assert.equal(prefix + data.the_date.format("YYYY-MM-DD") + suffix, interpolate(prefix + testcase[0] + suffix, data));
				callback();
			});
		}, done);
	});

	function verify_random_range(str, min, max, count) {
		// Because this test is inherently "random" (which is bad for unit tests), 
		// let's do it many times to lower the probability of false negative.
		for (var i = 0; i < (count || 100); i++) {
			var result = interpolate(str);
			var int_result = parseInt(result);
			assert(_.isNumber(int_result), "Result was not a number - " + result);
			assert.equal(int_result, result, "Result did not seem to be an integer - " + result);
			assert(int_result >= min, "Number was too low - " + result);
			assert(int_result <= max, "Number was too high - " + result);
		}
	}

	describe("Random numbers", () => {
		it("Should generate a random number within a range", () => {
			var min = 3, max = 7;
			verify_random_range("<% '" + min + "-" + max + "' | random %>", min, max);
		});
		it("Should generate a random number within a backwards range", () => {
			var min = 3, max = 7;
			verify_random_range("<% '" + max + "-" + min + "' | random %>", min, max);
		});
		it("Should generate a random number within a range and whitespace", () => {
			var min = 3, max = 7;
			verify_random_range("<% '" + min + "-" + max + "' | random %>", min, max);
		});
		it("Should return the number if min == max", () => {
			var min = 3, max = 3;
			verify_random_range("<% '" + min + "-" + max + "' | random %>", min, max);
		});
		it("Should generate a random number from X -> X+1 (same number)", () => {
			var min = 3, max = 4;
			verify_random_range("<% '" + min + "-" + max + "' | random %>", min, max);
		});
		it("Should generate a random number from 0 to max-1", () => {
			var max = 7;
			verify_random_range("<% '" + max + "' | random %>", 0, max);
		});
	});

	describe("Random array elements", () => {
		it("Should return a random element from an array", () => {
			var array = ["one", "two", "three"];
			// Because this test is inherently "random" (which is bad for unit tests), 
			// let's do it many times to lower the probability of false negative.
			for (var i = 0; i < 100; i++) {
				var result = interpolate("<% array | random %>", { array: array });
				assert(_.includes(array, result));
			}
		});

		it("Should return the single element from a single-element array", () => {
			var array = ["one"];
			// Because this test is inherently "random" (which is bad for unit tests), 
			// let's do it many times to lower the probability of false negative.
			for (var i = 0; i < 100; i++) {
				var result = interpolate("<% array | random %>", { array: array });
				assert(_.includes(array, result));
			}
		});

		it("Should return the element from a non array", () => {
			var array = "1";
			// Because this test is inherently "random" (which is bad for unit tests), 
			// let's do it many times to lower the probability of false negative.
			for (var i = 0; i < 100; i++) {
				var result = interpolate("<% array | random %>", { array: array + "-" + array });
				assert.equal(array, result);
			}
		});
	});

	describe("Multiple tokens", () => {
		it("Process multiple tokens", () => {
			var data = { one: "1", two: "2" };
			assert.equal(prefix + "1,2" + suffix, interpolate(prefix + "<% one %>,<% two %>" + suffix, data));
		});
	});

	describe("Array access", () => {
		var array = ["one", "two", "three"];
		var value = "replaced";
		it("First element", () => {
			assert.equal(prefix + array[0] + suffix, interpolate(prefix + "<% array.0 %>" + suffix, { array: array, "array.index": 0 }));
		});
		it("Third element", () => {
			assert.equal(prefix + array[2] + suffix, interpolate(prefix + "<% array.2 %>" + suffix, { array: array, "array.index": 2 }));
		});
		it("Out of bounds", () => {
			try {
				interpolate(prefix + "<% array.2 %>" + suffix, { array: array });
				assert.fail("Should have thrown an error");
			} catch (err) {
				// Noop
			}
		});
		it("Non-array", () => {
			assert.equal(prefix + value + suffix, interpolate(prefix + "<% value | current %>" + suffix, { value: value }));
		});
		it("Non-array, fake index", () => {
			assert.equal(prefix + value + suffix, interpolate(prefix + "<% value | current %>" + suffix, { value: value }));
		});
	});

	describe("Array join", () => {
		var array = ["one", "two", "three"];
		it("Comma-delimited", () => {
			assert.equal("one,two,three", interpolate("<% array | join %>", { array: array }));
		});
		it("Pipe-delimited", () => {
			assert.equal("one|two|three", interpolate("<% array | join('|')%>", { array: array }));
		});
		it("Default delimiter", () => {
			// Specifically changed this behavior with calfinated, so need to test differently.
			// There is no longer default stringification, but object-reference is returned instead.
			assert.equal(array, interpolate("<% array %>", { array: array }));
		});
		it("Tab delimiter", () => {
			// Specifically changed this behavior with calfinated, so need to test differently.
			// white-space is no longer significant unless quoted
			assert.equal("one	two	three", interpolate("<% array | join,'	' %>", { array: array }));
		});
		it("Space delimiter", () => {
			// Specifically changed this behavior with calfinated, so need to test differently.
			// white-space is no longer significant unless quoted
			assert.equal("one two three", interpolate("<% array | join,' ' %>", { array: array }));
		});
	});
});
