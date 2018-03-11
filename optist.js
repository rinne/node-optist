'use strict';

var Optist = function() {
	if (! (this instanceof Optist)) {
		throw new Error('Constructor must not be called directly');
	}
	this._opts = new Map();
	this._rest = undefined;
	this._synthCnt = 0;
	this._parsed = false;
	this._snl = [];
	this._explicitlyStopped = false;
};

Optist.prototype.simple = function(shortName, longName) {
	return this.o(shortName, longName, false, false, undefined, false, undefined);
};

Optist.prototype.counter = function(shortName, longName) {
	return this.o(shortName, longName, false, false, undefined, true, undefined);
};

Optist.prototype.multi = function(shortName, longName) {
	return this.o(shortName, longName, true, false, undefined, true, undefined);
};

Optist.prototype.attachOptArgCb = function(name, optArgCb) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	var o = this._opts.get(name);
	if (o === undefined) {
		throw new Error('Unable to find option ' + name);
	}
	if (o.optArgCb) {
		throw new Error('Argument callback can be set only once');
	}
	if (! opt.hasArg) {
		throw new Error('Argument callback is only allowed for an option with argument');
	}
	if (typeof(optArgCb) !== 'function') {
		throw new Error('Invalid argument callback');
	}
	if (o.defaultValue !== undefined) {
		var ndv = optArgCb(o.defaultValue);
		if (ndv === undefined) {
			throw new Error('Default value is not accepted by argument callback');
		}
		o.defaultValue = nd;
	}
	o.optArgCb = optArgCb;
	return this;
};

Optist.prototype.o = function(shortName,
							  longName,
							  hasArg,
							  required,
							  defaultValue,
							  multi,
							  optArgCb) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	if (shortName) {
		if (! Array.isArray(shortName)) {
			shortName = [ shortName ];
		}
		shortName.forEach(function(n) {
			if (! (typeof(n) === 'string') && n.match(/^[^=-]$/)) {
				throw new Error('Invalid short name for an option');
			}
			if (this._opts.has(n)) {
				throw new Error('Option definition short name conflict');
			}
		}.bind(this));
	} else {
		shortName = undefined;
	}
	if (longName) {
		if (! Array.isArray(longName)) {
			longName = [ longName ];
		}
		longName.forEach(function(n) {
			if (! (typeof(n) === 'string') && n.match(/^[^=-][^=]*[^=-]$/)) {
				throw new Error('Invalid long name for an option');
			}
			if (this._opts.has(n)) {
				throw new Error('Option definition long name conflict');
			}
		}.bind(this));
	} else {
		longName = undefined;
	}
	if (! (shortName || longName)) {
		throw new Error('Option required either a short or long name');
	}
	var opt = {
		shortName: shortName ? shortName[0] : undefined,
		longName: longName ? longName[0] : undefined,
		defaultValue: undefined,
		required: required ? true : false,
		multi: multi ? true : false,
		hasArg: hasArg ? true : false,
		required: required,
		multi: multi,
		optArgCb: undefined,
		value: undefined,
		lastSeen: undefined
	};
	if (optArgCb) {
		if (! opt.hasArg) {
			throw new Error('Argument callback is only allowed for an option with argument');
		}
		if (typeof(optArgCb) !== 'function') {
			throw new Error('Invalid argument callback');
		}
	} else {
		optArgCb = undefined;
	}
	if (defaultValue !== undefined) {
		if (! opt.hasArg) {
			throw new Error('Default value not allowed for an option with no argument');
		}
		if (opt.required) {
			throw new Error('Default value not allowed for a required option');
		}
		if (typeof(defaultValue) !== 'string') {
			throw new Error('Default value must be a string');
		}
		if (optArgCb) {
			defaultValue = optArgCb(defaultValue);
			if (defaultValue === undefined) {
				throw new Error('Default value is not accepted by argument callback');
			}
		}
	}
	opt.optArgCb = optArgCb;
	opt.defaultValue = defaultValue;
	if (opt.multi && opt.hasArg) {
		opt.value = [];
	} else if (opt.multi) {
		opt.value = 0;
	} else if (! opt.hasArg) {
		opt.value = false;
	}
	if (! shortName) {
		shortName = [ '-' + (++this._synthCnt) + '-' ];
	}
	this._snl.push(shortName[0]);
	shortName.forEach(function(n) {
		this._opts.set(n, opt);
	}.bind(this));
	if (longName) {
		longName.forEach(function(n) {
			this._opts.set(n, opt);
		}.bind(this));
	}
	return this;
};

Optist.prototype.parse = function(av, restRequireMin, restRequireMax) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	var m, n, o, a;
	if (! av) {
		av = process.argv.slice(2);
	}
	if (! Array.isArray(av)) {
		throw new Error('Bad argument list');
	}
	while (av.length > 0) {
		if (av[0] === '--') {
			av.shift();
			this._explicitlyStopped = true;
			break;
		}
		if ((m = av[0].match(/^(-)(.)()()$/)) ||
			(m = av[0].match(/^(-)([^-=]+)()()$/)) ||
			(m = av[0].match(/^(--)([^=][^=][^=]*)()()$/)) ||
			(m = av[0].match(/^(--)([^=][^=][^=]*)(=)(.*)$/)) ||
			(m = av[0].match(/^(-.*()()())$/))) {
			av.shift();
			if (m[2] === '') {
				throw new Error('Malformed option ' + m[1]);
			}
			if ((m[1] === '-') && (m[2].length > 1)) {
				m[2].split('').forEach(function(n) {
					o = this._opts.get(n);
					if (o === undefined) {
						throw new Error('Unknown option -' + n);
					}
					if (o.hasArg) {
						throw new Error('Options with arguments must not be combined');
					}
					if (o.multi) {
						o.value++;
					} else {
						if (o.value) {
							throw new Error('Option -' + n + ' is only allowed once');
						}
						o.value = true;
					}
					o.lastSeen = '-' + n;
				}.bind(this));
				continue;
			}
			n = m[1] + m[2];
			o = this._opts.get(m[2]);
			if (o === undefined) {
				throw new Error('Unknown option ' + n);
			}
			if (o.hasArg) {
				if (m[3] === '=') {
					a = m[4];
				} else if (av.length >= 1) {
					a = av.shift();
				} else {
					throw new Error('Option ' + n + ' requires an argument');
				}
			} else {
				if (m[3] === '=') {
					throw new Error('Option ' + n + ' does not accept an argument');
				}
			}
		} else {
			break;
		}
		if (o.hasArg && o.optArgCb) {
			var aa = (o.optArgCb)(a, n);
			if (aa === undefined) {
				throw new Error('Invalid argument "' + a + '" for option ' + n);
			}
			a = aa;
		}
		if (o.hasArg && o.multi) {
			o.value.push(a);
		} else if (o.multi) {
			o.value++;
		} else if (o.hasArg) {
			if (o.value !== undefined) {
				throw new Error('Option ' + n + ' is only allowed once');
			}
			o.value = a;
		} else {
			if (o.value) {
				throw new Error('Option ' + n + ' is only allowed once');
			}
			o.value = true;
		}
		o.lastSeen = n;
	}
	this._snl.forEach(function(n) {
		o = this._opts.get(n);
		if (o.required && (o.value === undefined)) {
			throw new Error('Required option ' +
							(o.longName ? ('--' + o.longName) : ('-' + o.shortName)) +
							' not given');
		}
	}.bind(this));
	if (restRequireMin !== undefined) {
		if (av.length < restRequireMin) {
			throw new Error('Too few command line arguments after options');
		}
	}
	if (restRequireMax !== undefined) {
		if (av.length > restRequireMax) {
			throw new Error('Too many command line arguments after options');
		}
	}
	this._rest = Array.from(av);
	this._parsed = true;
	return this;
}

Optist.prototype.parsePosix = function(av, restRequireMin, restRequireMax) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	if (! av) {
		av = process.argv.slice(2);
	}
	var rest = [];
	do {
		this._parsed = false;
		this._rest = undefined;
		this.parse(av);
		if (this._explicitlyStopped) {
			rest = rest.concat(this.rest());
			break;
		}
		av = this.rest();
		while ((av.length > 0) && (! av[0].match(/^-/))) {
			rest.push(av.shift());
		}
	} while(av.length > 0);
	if (restRequireMin !== undefined) {
		this._parsed = false;
		if (av.length < restRequireMin) {
			throw new Error('Too few command line arguments after options');
		}
	}
	if (restRequireMax !== undefined) {
		this._parsed = false;
		if (av.length > restRequireMax) {
			throw new Error('Too many command line arguments after options');
		}
	}
	this._rest = rest;
	return this;
};

Optist.prototype.rest = function() {
	if (! this._parsed) {
		throw new Error('Options not yet parsed');
	}
	return Array.from(this._rest);
}

Optist.prototype.value = function(name) {
	if (! this._parsed) {
		throw new Error('Options not yet parsed');
	}
	var o = this._opts.get(name);
	if (o === undefined) {
		return undefined;
	}
	if (o.hasArg) {
		if (o.multi) {
			if (o.value.length > 0) {
				return Array.from(o.value);
			} else if (o.defaultValue !== undefined) {
				return [ o.defaultValue ];
			} else {
				return [];
			}
		} else {
			if (o.value !== undefined) {
				return o.value;
			}
			if (o.defaultValue !== undefined) {
				return o.defaultValue;
			}
			return undefined;
		}
	}
	return o.value;
};

Optist.prototype.forEach = function(cb) {
	if (! this._parsed) {
		throw new Error('Options not yet parsed');
	}
	if (typeof(cb) !== 'function') {
		throw new Error('Bad callback');
	}
	this._snl.forEach(function(n) {
		var o = this._opts.get(n);
		var v = this.value(n);
		cb(o.shortName, o.longName, v);
	}.bind(this));
	return this;
};

module.exports = Optist;