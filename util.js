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
	if (s.replace(/^\s*/, '').replace(/\s$/, '').replace(/\s*,\s*/g, ',').split(',').some(function(n) {
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

function ipv4(s) {
	var m, i = integerWithLimitsCbFactory(0, 255), a, b, c, d;
	if (m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)) {
		a = i(m[1]);
		b = i(m[2]);
		c = i(m[3]);
		d = i(m[4]);
		if ((a !== undefined) && (b !== undefined) && (c !== undefined) && (d !== undefined)) {
			return a.toString() + '.' + b.toString() + '.' + c.toString() + '.' + d.toString();
		}
	}
	return undefined;
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

function allowListCbFactory(allowedValues) {
	if (! (Array.isArray(allowedValues))) {
		allowedValues = [];
	}
	allowedValues = allowedValues.filter(function(x) { return ((typeof(x) === 'string') || (x instanceof RegExp)); });
	return function(v) {
		if (typeof(v) !== 'string') {
			return undefined;
		}
		return ((allowedValues.some(function(x) {
			if (x instanceof RegExp) {
				return (v.match(x)) ? true : false;
			}
			return (x === v);
		})) ? v : undefined);
	}
}

function existingFileNameCb(s) {
	try {
		if (! fs.statSync(s).isFile()) {
			throw new Error('Invalid file');
		}
	} catch (e) {
		s = undefined;
	}
	return s;
}

function fileContentsStringCb(s) {
	try {
		if (! fs.statSync(s).isFile()) {
			throw new Error('Invalid file');
		}
		s = fs.readFileSync(s, { encoding: 'utf8', flag: 'r' } );
		if (! s) {
			throw new Error('File read error');
		}
	} catch (e) {
		s = undefined;
	}
	return s;
}


module.exports = {
	nonEmptyCb: nonEmptyCb,
	integerCb: integerCb,
	integerListCb: integerListCb,
	integerWithLimitsCbFactory: integerWithLimitsCbFactory,
	allowListCbFactory: allowListCbFactory,
	existingFileNameCb: existingFileNameCb,
	fileContentsStringCb: fileContentsStringCb,
	ipv4: ipv4
};
