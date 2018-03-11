'use strict';

const fs = require('fs');

function nonEmptyCb(s) {
	return (s.length > 0) ? s : undefined;
}

function integerCb(s) {
	var r;
	if (s.match(/^(0|-?[1-9][0-9]*)$/)) {
		if (Number.isSafeInteger(r = Number.parseInt(s))) {
			return r;
		}
	}
	return undefined;
}

function integerListCb(s) {
	var r = [];
	if (s.replace(/\s*,\s*/g, ',').split(',').some(function(n) {
		var x;
		if (n.match(/^(0|-?[1-9][0-9]*)$/)) {
			if (Number.isSafeInteger(x = Number.parseInt(n))) {
				r.push(x);
				return false;
			}
		}
		return true;
	})) {
		return undefined;
	}
	return (r.length > 0) ? r : undefined;
}

function integerWithLimitsCbFactory(min, max) {
	return function(s) {
		var r = integerCb(s);
		if (r === undefined) {
			return undefined;
		}
		if ((min !== undefined) && (r < min)) {
			return undefined;
		}
		if ((max !== undefined) && (r > max)) {
			return undefined;
		}
		return r;
	};
}

function existingFileNameCb(s) {
	try {
		if (! fs.isFile(fs.statSync(s))) {
			throw new Error('Invalid file name ' + s);
		}
	} catch (e) {
		s = undefined;
	};
	return s;
}

module.exports = {
	nonEmptyCb: nonEmptyCb,
	integerCb: integerCb,
	integerListCb: integerListCb,
	integerWithLimitsCbFactory: integerWithLimitsCbFactory,
	existingFileNameCb: existingFileNameCb
};
