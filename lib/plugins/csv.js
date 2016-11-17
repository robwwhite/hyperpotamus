module.exports.safe = true;
module.exports.manual_interpolation = true;

/*
Purpose:
  Outputs comma-separated values for all fields referenced by the specified array iterating until at least
  one of the arrays exhausted. Optionally prints out a "headers" row at the start. The fields in the array
  must exist as session variables, but the values can be a mixture of arrays or simple values.

  An optional "mapping" object can be specified which has key-names equal to the field names and an
  interpolatable string as the value.

 - csv:
    fields: array_name | <%! array_reference %>
    headers: true|false|only # defaults to false

 Examples:
 - csv:
    array: [ name, address, city, state ]
    mapping:
      state: <% state | upcase %>

 or

 - csv: [ "name", "address.street", "address.city", "address.state", "address.zipcode", "ssn" ]
 */

var _ = require("lodash");

module.exports.normalize = function (action) {
	if (_.has(action, "csv")) {
		if (_.isArray(action.csv) || _.isString(action.csv)) {
			action.csv = { fields: action.csv };
		}
		return action;
	}
};

module.exports.process = function (context) {
	// Manual Interpolation to protect mapping values until iteration time
	this.csv.fields = context.interpolate(this.csv.fields, context.session);
	this.csv.header = context.interpolate(this.csv.header, context.session);

	var self = this;
	var fieldNames;

	if (_.isString(this.csv.fields)) { // Must be the name of the array containing the column names
		fieldNames = context.session[this.csv.fields];
		if (!_.isArray(fieldNames)) {
			throw new Error("csv property does not refer to an array of field names");
		}
	}
	else if (_.isArray(this.csv.fields)) {
		fieldNames = this.csv.fields;
	}
	else {
		throw new Error("csv .fields property is not an array name or array reference");
	}

	if (this.csv.header) {
		if (context.emit) {
			context.emit(_.map(fieldNames, csv_safe).join(","), this.channel);
		}
		// If header is "only", don't try to write any data rows
		if(this.csv.header == "only") {
			return;
		}
	}

	var exhausted = false;
	while (!exhausted) {
		var has_arrays = false;
		var result = "";
		for (var i = 0; i < fieldNames.length; i++) {
			if (i > 0) {
				result += ",";
			}

			// Lookup each value, if value is an array, pick the current value and add to list to be iterated.
			var value;
			if (_.has(this.csv.mapping, fieldNames[i])) {
				value = context.interpolate(this.csv.mapping[fieldNames[i]], context.session); // If a mapping exists, use it.
			}
			else {
				value = context.interpolate("<%!" + fieldNames[i] + "%>", context.session); // retrieve the value (not as a string)
			}
			if (_.isArray(value)) {
				has_arrays = true;
				result += csv_safe(value[value.currentIndex || 0]);
				// TODO - "borrowed" from iterate.js - need to refactor to a shared function
				if (!_.has(value, "currentIndex")) { // This is the first time, so the index was 0 before incrementing
					module.exports.logger.trace("Iteration for " + fieldNames[i] + " initializing to 0.");
					value.currentIndex = 0;
				}
				if (value.currentIndex < value.length - 1) { // If we still have elements
					module.exports.logger.trace("Iteration for " + fieldNames[i] + " iterating.");
					value.currentIndex++;
				}
				else { // We reached the end
					module.exports.logger.trace("Iteration for " + fieldNames[i] + " exhausted.");
					delete(value.currentIndex);
					exhausted = true;
				}
			}
			else {
				result += csv_safe(value);
			}
		}
		if (context.emit) {
			context.emit(result, this.channel);
		}
		if (!has_arrays) {
			exhausted = true;
		}
	}
};

function csv_safe(value) {
	value = value.toString().split("\"").join("\\\"");
	if (value.indexOf(",") >= 0) {
		value = "\"" + value + "\"";
	}
	return value;
}