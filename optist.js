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
	this._restRequireMin = undefined;
	this._restRequireMax = undefined;
	this._paramName = [];
	this._paramDescription = [];
	this._help = false;
	this._helpCmd = undefined;
};

Optist.prototype.additional = function(restRequireMin, restRequireMax) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	if (restRequireMin === null) {
		restRequireMin = undefined;
	}
	if (restRequireMax === null) {
		restRequireMax = undefined;
	}
	if ((restRequireMin === undefined) && (restRequireMax === undefined)) {
		return this;
	}
	if (((this._restRequireMin !== undefined) || (this._restRequireMax !== undefined)) &&
		((this._restRequireMin !== restRequireMin) || (this._restRequireMax !== restRequireMax))) {
		throw new Error('Limits for number of additional parameters can be set only once');
	}
	if (restRequireMin !== undefined) {
		if (! (Number.isSafeInteger(restRequireMin) && (restRequireMin >= 0))) {
			throw new Error('Illegal value for additional parameter minimum limit');
		}
	}
	if (restRequireMax !== undefined) {
		if (! (Number.isSafeInteger(restRequireMax) && (restRequireMax >= 0))) {
			throw new Error('Illegal value for additional parameter maximum limit');
		}
	}
	if (! ((restRequireMin === undefined) ||
		   (restRequireMax === undefined) ||
		   (restRequireMax >= restRequireMin))) {
		throw new Error('Mutually incompatible values for additional parameter limits');
	}
	this._restRequireMin = restRequireMin;
	this._restRequireMax = restRequireMax;
	return this;
};

Optist.prototype.simple = function(shortName, longName) {
	return this.o(shortName, longName, false, false, undefined, false, undefined);
};

Optist.prototype.counter = function(shortName, longName) {
	return this.o(shortName, longName, false, false, undefined, true, undefined);
};

Optist.prototype.string = function(shortName, longName, allowedValues) {
	var cb;
	if (allowedValues) {
		if (typeof(allowedValues) === 'string') {
			allowedValues = [ allowedValues ];
		} else if (allowedValues instanceof RegExp) {
			allowedValues = [ allowedValues ];
		}
		if (! Array.isArray(allowedValues)) {
			throw new Error('Invalid allwed values');
		}
		allowedValues.forEach(function(x) {
			if (! ((typeof(x) === 'string') || (x instanceof RegExp))) {
				throw new Error('Allowed value must be a string or RegExp');
			}
		}.bind(this));
		cb = function(v) {
			if (allowedValues.some(function(x) {
				if (typeof(x) === 'string') {
					if (v === x) {
						return true;
					}
				} else if (x instanceof RegExp) {
					if (v.match(x)) {
						return true;
					}
				}
				return false;
			}.bind(this))) {
				return v;
			}
			return undefined;
		}.bind(this);
	} else {
		allowedValues = undefined;
		cb = undefined;
	}
	return this.o(shortName, longName, true, false, undefined, false, cb);
};

Optist.prototype.multi = function(shortName, longName) {
	return this.o(shortName, longName, true, false, undefined, true, undefined);
};

Optist.prototype.opts = function(opts) {
	var err;
	if (! Array.isArray(opts)) {
		opts = [ opts ];
	}
	opts.some(function(o) {
		//console.log(o);
		var pn;
		if (! (o && (typeof(o) === 'object'))) {
			err = new Error('Invalid option definition object');
			return true;
		}
		if (typeof(o.shortName) === 'string') {
			pn = o.shortName;
		} else if (Array.isArray(o.shortName) && (o.shortName.length > 0) && typeof(o.shortName[0]) === 'string') {
			pn = o.shortName[0];
		} else if (typeof(o.longName) === 'string') {
			pn = o.longName;
		} else if (Array.isArray(o.longName) && (o.longName.length > 0) && typeof(o.longName[0]) === 'string') {
			pn = o.longName[0];
		} else {
			err = new Error('Invalid names in option definition object');
			return true;
		}
		try {
			this.o(o.shortName, o.longName, o.hasArg, o.required, o.defaultValue, o.multi, o.optArgCb, o.requiresAlso, o.conflictsWith);
			if (o.description) {
				this.describeOpt(pn, o.description);
			}
		} catch (e) {
			err = e;
		}
		return err ? true : false;
	}.bind(this));
	if (err) {
		throw err;
	}
	return this;
};

Optist.prototype.o = function(shortName,
							  longName,
							  hasArg,
							  required,
							  defaultValue,
							  multi,
							  optArgCb,
							  requiresAlso,
							  conflictsWith) {
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
	if ((requiresAlso === undefined) || (requiresAlso === null)) {
		requiresAlso = [];
	} else if (! Array.isArray(requiresAlso)) {
		requiresAlso = [ requiresAlso ];
	}
	if (requiresAlso.some(function(x) { return (! ((typeof(x) === 'string') && (x.length > 0))); })) {
		throw new Error('Invalid name in requiresAlso');
	}
	requiresAlso = Array.from(requiresAlso);
	if ((conflictsWith === undefined) || (conflictsWith === null)) {
		conflictsWith = [];
	} else if (! Array.isArray(conflictsWith)) {
		conflictsWith = [ conflictsWith ];
	}
	if (conflictsWith.some(function(x) { return (! ((typeof(x) === 'string') && (x.length > 0))); })) {
		throw new Error('Invalid name in conflictsWith');
	}
	conflictsWith = Array.from(conflictsWith);
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
		requiresAlso: requiresAlso,
		conflictsWith: conflictsWith,
		description: undefined,
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

Optist.prototype.describeParam = function(num, name, description) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	if (name === null) {
		name = undefined;
	}
	if (description === null) {
		description = undefined;
	}
	if (! (Number.isSafeInteger(num) && (num >= 0))) {
		throw new Error('Invalid parameter number');
	}
	if (name && (typeof(name) !== 'string')) {
		throw new Error('Invalid parameter name');
	}
	if (description && (typeof(description) !== 'string')) {
		throw new Error('Invalid parameter description');
	}
	if ((this._paramName[num] !== undefined) || (this._paramDescription[num] !== undefined)) {
		throw new Error('Parameter description can be set only once for each parameter');
	}
	if (! name) {
		name = 'param' + (num + 1).toFixed(0);
	}
	this._paramName[num] = name;
	this._paramDescription[num] = description;
	return this;
}

Optist.prototype.describeOpt = function(name, description) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	var o = this._opts.get(name);
	if (o === undefined) {
		throw new Error('Unable to find option ' + name);
	}
	if (typeof(description) !== 'string') {
		throw new Error('Invalid description for option');
	}
	if (o.description !== undefined) {
		throw new Error('Argument description can be set only once');
	}
	o.description = description;
	return this;
}

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
	if (! o.hasArg) {
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

Optist.prototype.parse = function(av, restRequireMin, restRequireMax) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	if (! av) {
		av = process.argv.slice(2);
	}
	if (! Array.isArray(av)) {
		throw new Error('Bad argument list');
	}
	if ((restRequireMin !== undefined) || (restRequireMax !== undefined)) {
		this.additional(restRequireMin, restRequireMax)
	}
	var m, n, o, a, em;
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
				em = 'Malformed option ' + m[1];
				this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
				throw new Error(em);
			}
			if ((m[1] === '-') && (m[2].length > 1)) {
				m[2].split('').forEach(function(n) {
					o = this._opts.get(n);
					if (o === undefined) {
						em = 'Unknown option -' + n;
						this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
						throw new Error(em);
					}
					if (o.thisIsHelp) {
						this.showHelpAndExit(0);
					}
					if (o.hasArg) {
						em = 'Options with arguments must not be combined';
						this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
						throw new Error(em);
					}
					if (o.multi) {
						o.value++;
					} else {
						if (o.value) {
							em = 'Option -' + n + ' is only allowed once';
							this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
							throw new Error(em);
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
				em = 'Unknown option ' + n;
				this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
				throw new Error(em);
			}
			if (o.thisIsHelp) {
				this.showHelpAndExit(0);
			}
			if (o.hasArg) {
				if (m[3] === '=') {
					a = m[4];
				} else if (av.length >= 1) {
					a = av.shift();
				} else {
					em = 'Option ' + n + ' requires an argument';
					this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
					throw new Error(em);
				}
			} else {
				if (m[3] === '=') {
					em = 'Option ' + n + ' does not accept an argument';
					this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
					throw new Error(em);
				}
			}
		} else {
			break;
		}
		if (o.hasArg && o.optArgCb) {
			var aa = (o.optArgCb)(a, n);
			if (aa === undefined) {
				em = 'Invalid argument "' + a + '" for option ' + n;
				this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
				throw new Error(em);
			}
			a = aa;
		}
		if (o.hasArg && o.multi) {
			o.value.push(a);
		} else if (o.multi) {
			o.value++;
		} else if (o.hasArg) {
			if (o.value !== undefined) {
				em = 'Option ' + n + ' is only allowed once';
				this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
				throw new Error(em);
			}
			o.value = a;
		} else {
			if (o.value) {
				em = 'Option ' + n + ' is only allowed once';
				this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
				throw new Error(em);
			}
			o.value = true;
		}
		o.lastSeen = n;
	}
	this._snl.forEach(function(n) {
		o = this._opts.get(n);
		if (o.required && (o.value === undefined)) {
			em = ('Required option ' +
				  (o.longName ? ('--' + o.longName) : ('-' + o.shortName)) +
				  ' not given');
			this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
			throw new Error(em);
		}
	}.bind(this));
	this._snl.forEach(function(n) {
		o = this._opts.get(n);
		if (o.value === undefined) {
			return;
		}
		o.requiresAlso.forEach(function(n2) {
			var o2 = this._opts.get(n2);
			if (! o2) {
				throw new Error('Option ' +
								(o.longName ? ('--' + o.longName) : ('-' + o.shortName)) +
								' referring to an undefined option "' +
								n2 +
								'" as required');
			}
			if (((((o2.hasArg && (o2.value !== undefined)) ||
				   ((! o2.hasArg) &&
					((o2.multi && (o2.value !== 0)) ||
					 ((! o2.multi) && (o2.value !== false))))) ? 1 : 0) +
				 (((o.hasArg && (o.value !== undefined)) ||
				   ((! o.hasArg) &&
					((o.multi && (o.value !== 0)) ||
					 ((! o.multi) && (o.value !== false))))) ? 1 : 0)) == 1) {
				em = ('Option ' +
					  (o.longName ? ('--' + o.longName) : ('-' + o.shortName)) +
					  ' requires also option ' +
					  (o2.longName ? ('--' + o2.longName) : ('-' + o2.shortName)));
				this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
				throw new Error(em);
			}
		}.bind(this));
		o.conflictsWith.forEach(function(n2) {
			var o2 = this._opts.get(n2);
			if (! o2) {
				throw new Error('Option ' +
								(o.longName ? ('--' + o.longName) : ('-' + o.shortName)) +
								' referring to an undefined option "' +
								n2 +
								'" as conflicting');
			}
			if (((((o2.hasArg && (o2.value !== undefined)) ||
				   ((! o2.hasArg) &&
					((o2.multi && (o2.value !== 0)) ||
					 ((! o2.multi) && (o2.value !== false))))) ? 1 : 0) +
				 (((o.hasArg && (o.value !== undefined)) ||
				   ((! o.hasArg) &&
					((o.multi && (o.value !== 0)) ||
					 ((! o.multi) && (o.value !== false))))) ? 1 : 0)) > 1) {
				em = ('Option ' +
					  (o.longName ? ('--' + o.longName) : ('-' + o.shortName)) +
					  ' conflicts with option ' +
					  (o2.longName ? ('--' + o2.longName) : ('-' + o2.shortName)));
				this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
				throw new Error(em);
			}
		}.bind(this));
	}.bind(this));
	if (this._restRequireMin !== undefined) {
		if (av.length < this._restRequireMin) {
			em = 'Too few command line arguments after options';
			this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
			throw new Error(em);
		}
	}
	if (this._restRequireMax !== undefined) {
		if (av.length > this._restRequireMax) {
			em = 'Too many command line arguments after options';
			this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
			throw new Error(em);
		}
	}
	this._rest = Array.from(av);
	this._parsed = true;
	return this;
}

Optist.prototype.parsePosix = function(av, restRequireMin, restRequireMax) {
	var em;
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	if (! av) {
		av = process.argv.slice(2);
	}
	if ((restRequireMin !== undefined) || (restRequireMax !== undefined)) {
		this.additional(restRequireMin, restRequireMax)
	}
	restRequireMin = this._restRequireMin;
	restRequireMax = this._restRequireMax;
	this._restRequireMin = undefined;
	this._restRequireMax = undefined;
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
	this._restRequireMin = restRequireMin;
	this._restRequireMax = restRequireMax;
	if (this._restRequireMin !== undefined) {
		if (rest.length < this._restRequireMin) {
			this._parsed = false;
			em = 'Too few command line arguments after options';
			this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
			throw new Error(em);
		}
	}
	if (this._restRequireMax !== undefined) {
		if (rest.length > this._restRequireMax) {
			this._parsed = false;
			em = 'Too many command line arguments after options';
			this.showErrorMessageHelpAndExitIfHelpEnabled(em, 1);
			throw new Error(em);
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

Optist.prototype.values = function() {
	if (! this._parsed) {
		throw new Error('Options not yet parsed');
	}
	var r = {};
	this._opts.forEach(function(_, k) {
		if (! k.match(/^-\d+-$/)) {
			var v = this.value(k);
			if (v !== undefined) {
				r[k] = v;
			}
		}
	}.bind(this));
	r['-'] = this.rest();
	return r;
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

Optist.prototype.some = function(cb) {
	if (! this._parsed) {
		throw new Error('Options not yet parsed');
	}
	if (typeof(cb) !== 'function') {
		throw new Error('Bad callback');
	}
	return this._snl.some(function(n) {
		var o = this._opts.get(n);
		var v = this.value(n);
		return cb(o.shortName, o.longName, v);
	}.bind(this));
};

Optist.prototype.help = function(cmd) {
	if (this._parsed) {
		throw new Error('Options already parsed');
	}
	if (this._help) {
		throw new Error('Automatic help can be set only once');
	}
	if (! ((typeof(cmd) === 'string') && (cmd !== ''))) {
		cmd = undefined;
	}
	if (this._opts.has('h') || this._opts.has('help')) {
		throw new Error('Option definition conflict in help');
	}
	this._help = true;
	this._helpCmd = cmd;
	this.simple('h', 'help');
	this.describeOpt('help', 'Show help and exit');
	var o = this._opts.get('help');
	o.thisIsHelp = true;
	return this;
};

Optist.prototype.generateHelp = function(cmd) {
	var	i, r, maxLongOptLen = 0;
	var hasOpts = false, hasShortOpts = false, hasLongOpts = false;
	var hasOptArgs = false, hasShortOptArgs = false, hasLongOptArgs = false;
	if (! ((typeof(cmd) === 'string') && (cmd !== ''))) {
		cmd = process.argv[0].replace(/^.*\//, '') + ' ' + process.argv[1].replace(/^.*\//, '');
	}
	this._snl.forEach(function(n) {
		var o = this._opts.get(n);
		hasOpts = true;
		if (o.shortName) {
			hasShortOpts = true;
			if (o.hasArg) {
				hasShortOptArgs = true;
			}
		}
		if (o.longName) {
			hasLongOpts = true;
			maxLongOptLen = Math.max(maxLongOptLen, o.longName.length);
			if (o.hasArg) {
				hasLongOptArgs = true;
			}
		}
		if (o.hasArg) {
			hasOptArgs = true;
		}
	}.bind(this));
	if (hasOpts) {
		r = cmd + ' [<opt> ...]';
	} else {
		r = cmd;
	}
	if (((this._restRequireMin === undefined) && (this._restRequireMax === undefined)) ||
		((this._restRequireMin !== undefined) && (this._restRequireMin > 10)) ||
		((this._restRequireMax !== undefined) && (this._restRequireMax > 10))) {
		r += ' [<param> ...]';
	} else if ((this._restRequireMin !== undefined) && (this._restRequireMax === undefined)) {
		for (i = 0; i < this._restRequireMin; i++) {
			r += ' <' + ((this._paramName[i] !== undefined) ? this._paramName[i] : ('param' + (i+1).toFixed(0))) + '>';
		}
		r += ' [ <param> ...]';
	} else if ((this._restRequireMin === undefined) && (this._restRequireMax !== undefined)) {
		for (i = 0; i < this._restRequireMax; i++) {
			r += ' [<' + ((this._paramName[i] !== undefined) ? this._paramName[i] : ('param' + (i+1).toFixed(0))) + '>';
		}
		r += (']').repeat(this._restRequireMax);
	} else {
		for (i = 0; i < this._restRequireMin; i++) {
			r += ' <' + ((this._paramName[i] !== undefined) ? this._paramName[i] : ('param' + (i+1).toFixed(0))) + '>';
		}
		for (/*NOTHING*/; i < this._restRequireMax; i++) {
			r += ' [<' + ((this._paramName[i] !== undefined) ? this._paramName[i] : ('param' + (i+1).toFixed(0))) + '>';
		}
		r += (']').repeat(this._restRequireMax - this._restRequireMin);
	}
	if (hasOpts) {
		r += "\n" + 'Options:'
		this._snl.forEach(function(n) {
			var o = this._opts.get(n), lo;;
			r += "\n ";
			if (hasShortOpts) {
				if (o.shortName) {
					r += ' -' + o.shortName;
					if (hasShortOptArgs) {
						if (o.hasArg) {
							r += ' <arg>';
						} else {
							r += '      ';
						}
					}
				} else {
					r += '   ' + (hasShortOptArgs ? '      ' : '');
				}
			}
			if (hasLongOpts) {
				lo = '';
				if (o.longName) {
					lo += '--' + o.longName;
					if (hasLongOptArgs) {
						if (o.hasArg) {
							lo += '=<arg>';
						} else {
							lo += '      ';
						}
					}
				}
				r += (' ' +
					  (hasShortOpts ? ' ' : '') +
					  (lo + (' ').repeat(maxLongOptLen + 32)).slice(0, 2 + maxLongOptLen + (hasLongOptArgs ? 6 : 0)));
			}
			if (o.description) {
				r += '  ' + o.description;
			}
		}.bind(this));
	}
	return r;
};

Optist.prototype.showErrorMessageHelpAndExitIfHelpEnabled = function(message, exitValue) {
	if (! this._help) {
		return this;
	}
	try {
		var m = ((((typeof(message) === 'string') && (message !== '')) ? ('Error: ' + message + "\n") : '') +
				 "Usage:\n  " +
				 this.generateHelp(this._helpCmd));
		console.log(m);
	} catch(e) {
		console.log('Fatal usage error');
	}
	process.exit(exitValue);
	process.exit(1);
};

Optist.prototype.showHelpAndExit = function(exitValue) {
	try {
		var m = "Usage:\n  " + this.generateHelp(this._helpCmd);
		console.log(m);
	} catch(e) {
		console.log('Fatal usage error');
	}
	process.exit(exitValue);
	process.exit(1);
};

module.exports = Optist;
