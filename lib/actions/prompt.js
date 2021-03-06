module.exports.safe = false;

/*
Purpose:
  Prompts the user for input values. Storing the results in the context.
*/

var _ = require("lodash");
var regex_helper = require("./helpers/regex");
var prompt = require("prompt");

module.exports.normalize = function (action) {
	if (_.has(action, "prompt")) {
		if (!_.isObject(action.prompt.properties)) {
			var prompts = [];
			for (var key in action.prompt) {
				var item = action.prompt[key];
				if (_.isString(item)) {
					item = { description: item };
				}
				item.name = key;
				if (_.isString(item.pattern)) {
					item.pattern = regex_helper.extract_regex(item.pattern);
				}
				prompts.push(item);
			}
			action.prompt = prompts;
			return action;
		}
	}
};

module.exports.process = function (context, callback) {
	for (var i = this.prompt.length - 1; i >= 0; i--) {
		if (_.isObject(this.prompt[i].pattern) && !_.isRegExp(this.prompt[i].pattern)) {
			this.prompt[i].pattern = regex_helper.make_regex(this.prompt[i].pattern, context);
		}
	}
	this.prompt = _.filter(this.prompt, function (item) {
		return item.required || _.isUndefined(_.get(context.session, item.name));
	});
	prompt.override = context.sesion;
	prompt.message = "hyperpotamus";
	prompt.colors = false;
	prompt.start();
	prompt.addProperties(context.session, this.prompt, function () {
		callback();
	});
};
