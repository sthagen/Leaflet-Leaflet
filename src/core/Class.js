import * as Util from './Util.js';

// @class Class

// @section
// @uninheritable

// Thanks to John Resig and Dean Edwards for inspiration!

export class Class {
	// @function extend(props: Object): Function
	// [Extends the current class](#class-inheritance) given the properties to be included.
	// Deprecated - use `class X extends Class` instead!
	// Returns a Javascript function that is a class constructor (to be called with `new`).
	static extend({statics, includes, ...props}) {
		const NewClass = class extends this {};

		// inherit parent's static properties
		Object.setPrototypeOf(NewClass, this);

		const parentProto = this.prototype;
		const proto = NewClass.prototype;

		// mix static properties into the class
		if (statics) {
			Object.assign(NewClass, statics);
		}

		// mix includes into the prototype
		if (Array.isArray(includes)) {
			for (const include of includes) {
				Object.assign(proto, include);
			}
		} else if (includes) {
			Object.assign(proto, includes);
		}

		// mix given properties into the prototype
		Object.assign(proto, props);

		// merge options
		if (proto.options) {
			proto.options = parentProto.options ? Object.create(parentProto.options) : {};
			Object.assign(proto.options, props.options);
		}

		proto._initHooks = [];

		return NewClass;
	}

	// @function include(properties: Object): this
	// [Includes a mixin](#class-includes) into the current class.
	static include(props) {
		const parentOptions = this.prototype.options;
		Object.assign(this.prototype, props);
		if (props.options) {
			this.prototype.options = parentOptions;
			this.mergeOptions(props.options);
		}
		return this;
	}

	// @function setDefaultOptions(options: Object): this
	// Configures the [default `options`](#class-options) on the prototype of this class.
	static setDefaultOptions(options) {
		Util.setOptions(this.prototype, options);
		return this;
	}

	// @function mergeOptions(options: Object): this
	// [Merges `options`](#class-options) into the defaults of the class.
	static mergeOptions(options) {
		this.prototype.options ??= {};
		Object.assign(this.prototype.options, options);
		return this;
	}

	// @function addInitHook(fn: Function): this
	// Adds a [constructor hook](#class-constructor-hooks) to the class.
	static addInitHook(fn, ...args) { // (Function) || (String, args...)
		const init = typeof fn === 'function' ? fn : function () {
			this[fn].apply(this, args);
		};

		this.prototype._initHooks ??= [];
		this.prototype._initHooks.push(init);
		return this;
	}

	constructor(...args) {
		this._initHooksCalled = false;

		Util.setOptions(this);

		// call the constructor
		if (this.initialize) {
			this.initialize(...args);
		}

		// call all constructor hooks
		this.callInitHooks();
	}

	callInitHooks() {
		if (this._initHooksCalled) {
			return;
		}

		// collect all prototypes in chain
		const prototypes = [];
		let current = this;

		while ((current = Object.getPrototypeOf(current)) !== null) {
			prototypes.push(current);
		}

		// reverse so the parent prototype is first
		prototypes.reverse();

		// call init hooks on each prototype
		for (const proto of prototypes) {
			for (const hook of proto._initHooks ?? []) {
				hook.call(this);
			}
		}

		this._initHooksCalled = true;
	}
}
