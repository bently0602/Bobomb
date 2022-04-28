var Bobomb = { };

//
Bobomb['Namespace'] = function(namespace) {
	this.namespace = namespace;
};

Bobomb['nsSplit'] = '.';

Bobomb['ns'] = function(x, scope = window) {
	if (!Array.isArray(x)) { x = x.split(Bobomb['nsSplit']); }

	var t = function(y, acc, cont) {
		if (y.length == 0) {
			return cont;
		}

		if (!acc) {
			acc = []; 
		}

		acc.push(y.shift());

		var lastAccItem = acc[acc.length - 1];
		if (!cont[lastAccItem]) { 
			cont[lastAccItem] = new Bobomb['Namespace'](acc.join(Bobomb['nsSplit']));
		}
		
		return t(y, acc, cont[lastAccItem]);
	};

	return t(x, null, scope);
};
Bobomb['namespace'] = Bobomb['ns'];

Bobomb['create'] = function(x, ...args) {
	var nsSpec = x.split(Bobomb['nsSplit']);
	var className = nsSpec.pop();
	var ns = Bobomb['ns'](nsSpec);
	return new (ns)[className](...args);
};
Bobomb['new'] = Bobomb['create'];

// shallow, nested objects are copied as reference
Bobomb['clone'] = function(x) {
	return Object.assign({}, x);
};

Bobomb['extend'] = function(x, ...args) {
	var z = Bobomb['clone'](x);
	// https://stackoverflow.com/questions/171251/how-can-i-merge-properties-of-two-javascript-objects-dynamically
	//return {...z, ...args};
	return Object.assign(z, ...args)
};
Bobomb['merge'] = Bobomb['extend'];

Bobomb['watch'] = function(obj, cb) {
	// https://davidwalsh.name/watch-object-changes
	// https://stackoverflow.com/questions/42747189/how-to-watch-complex-objects-and-their-changes-in-javascript
    // we use unique field to determine if object is proxy
    // we can't test this otherwise because typeof and
    // instanceof is used on original object
    if (obj && obj.__proxy__) {
         return obj;
    }

    var proxy = new Proxy(obj, {
        get: function(obj, name) {
            if (name == '__proxy__') {
                return true;
            }
            return obj[name];
        },
        set: function(obj, name, value) {
            var old = obj[name];
            if (value && typeof value == 'object') {
                // new object need to be proxified as well
                value = proxify(value, change);
            }
            obj[name] = value;
            change(obj, name, old, value);
        }
    });

    for (var prop in obj) {
        if (obj.hasOwnProperty(prop) && obj[prop] &&
            typeof obj[prop] == 'object') {
            // proxify all child objects
            obj[prop] = proxify(obj[prop], change);
        }
    }
    return proxy;
};

// https://stackoverflow.com/questions/384286/how-do-you-check-if-a-javascript-object-is-a-dom-object?page=1&tab=votes#tab-top
Bobomb['isElement'] = function(el) {
    return el instanceof Element || el instanceof HTMLDocument;  
};

// https://stackoverflow.com/questions/5999998/check-if-a-variable-is-of-function-type
Bobomb['isFunction'] = function(functionToCheck) {
	return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
};

Bobomb['isString'] = function(str) {
	return typeof str === 'string' || str instanceof String;
};

//https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
Bobomb['generateUUID'] = function() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
};

Bobomb['camelCaseToKabob'] = function(str) {
	// https://gist.github.com/nblackburn/875e6ff75bc8ce171c758bf75f304707
	/*
	fooBar                              ->  foo-bar
	FooBar                              ->  foo-bar
	AFooBar                             ->  a-foo-bar
	AFooBarACRONYM                      ->  a-foo-bar-acronym
	ACRONYMFooBar                       ->  acronym-foo-bar
	FooACRONYMBar                       ->  foo-acronym-bar
	ACRONYMFooACRONYMBarACRONYM         ->  acronym-foo-acronym-bar-acronym
	ACRONYM1Foo1ACRONYM2Bar1ACRONYM3    ->  acronym1-foo1-acronym2-bar1-acronym3
	*/
	return str
        .replace(/\B([A-Z])(?=[a-z])/g, '-$1')
        .replace(/\B([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();
};

Bobomb['styleSpecToString'] = function(spec) {
	if (typeof spec == 'string') {
		if (spec.trim() == '') { return ''; }
		if (!spec.endsWith(';')) {
			spec = spec + ';';
		}
		return spec;
	}

	var style = [];
	Object.entries(spec).forEach(i => {
		const [key, value] = i;
		style.push(`${Bobomb['camelCaseToKabob'](key)}: ${value}`)
	});

	spec = style.join(';');
	if (spec.trim() == '') { return ''; }
	return spec + ';';
};

Bobomb['componentStore'] = {
	store: { },
	register: (ID, ref) => {
		ref._isBobombManaged = true;
		if (!ID.startsWith('#')) {
			ID = `#${ID}`;
		}
		Bobomb['componentStore']['store'][ID] = ref;
		return ID;
	},
	remove: (ID) => {
		if (!ID.startsWith('#')) {
			ID = `#${ID}`;
		}
		
		var returnCmp = Bobomb['componentStore']['store'][ID];
		if (!returnCmp) {
			return false;
		}
		delete Bobomb['componentStore']['store'][ID];
		
		return true;
	},
	get: (ID) => {
		if (!ID.startsWith('#')) {
			ID = `#${ID}`;
		}
		var returnCmp = Bobomb['componentStore']['store'][ID];
		if (!returnCmp) {
			throw `no Bobomb component with ID "${ID}" registered`;
		}
		return returnCmp;
	},
	exists: (ID) => {
		if (!ID.startsWith('#')) {
			ID = `#${ID}`;
		}
		var returnCmp = Bobomb['componentStore']['store'][ID];
		if (!returnCmp) {
			return false;
		}
		return true;
	}
};
Bobomb['getComponent'] = Bobomb['componentStore']['get'];

Bobomb.ns('Bobomb.AJAX')['request'] = function(spec) {
	var fetchSpec = {};
	if (spec.method.toLowerCase() == 'post') {
		fetchSpec = {
			body: (() => {
				let formData = new FormData();
				for (var p in spec.params) {
					formData.append(p, spec.params[p]);
				}
				return formData;
			})(),
			method: spec.method
		};	
	} else {
		fetchSpec = {
			method: spec.method.toLowerCase()
		};
		spec.url = spec.url + '?' + new URLSearchParams(spec.params).toString();
	}
	
	fetchSpec['credentials'] = 'include';
	if (spec.headers) { fetchSpec['headers'] = spec.headers; }
	
	fetch(spec.url, fetchSpec).then(function(response) {
		spec.callback(
			(spec.isJSON ?? true) ? response.json() : response.text()
		);
	});
};

Bobomb.ns('Bobomb.Components')['Component'] = class {
	tagName = null;
	id = null;
	el = null;
	listeners = { };
	ownerCt = null;
	_isBobombManaged = false;

	constructor(spec) {
		//
		// any overrides to attributes spec'd by object
		//

		if (spec.items && spec.html) {
			console.warn('cant have items and html properties in component, items will take precedent');
		}

		if (!this.tagName) {
			this.tagName = spec.tagName ?? 'div';
		}
		delete spec.tagName;

		this.id = spec.id ?? Bobomb['generateUUID']();
		delete spec.id;
		
		this.layout = spec.layout ?? (() => { return null });
		delete spec.layout;

		// creation
		this.el = document.createElement(this.tagName);
		
		// id set
		this.el.setAttribute('id', this.id);
		Bobomb['componentStore']['register'](this.id, this);

		// css class(es)
		if (spec.cls) {
			if (!Array.isArray(spec.cls)) {
				spec.cls = [spec.cls];	
			}
			spec.cls = spec.cls.join(' ').trim();
			this.el.className += spec.cls;	
		}
		delete spec.cls;

		// style
		var setStyle = Bobomb['styleSpecToString'](spec.style ?? '');
		if (setStyle.trim() != '') {
			this.el.setAttribute('style', setStyle);
		}
		delete spec.style;

		// inner items
		if (spec.items) {
			// allow for just passing an object too
			if (!Array.isArray(spec.items)) {
				spec.items = [spec.items];
			}

			// loop through items and add to this component
			spec.items.forEach(i => {
				// check if bobomb already registered/created
				if (!i._isBobombManaged) {
					var targetType = i.xtype ?? 'component';
					// uppercase the first letter in "xtype"
					targetType = targetType[0].toUpperCase() + targetType.toLowerCase().slice(1);
					delete i.xtype;
					// apply any defaults if needed
					i = Bobomb['extend'](i, spec.defaults ?? { });
					// create and reassign 'i'
					i = Bobomb['create'](`Bobomb.Components.${targetType}`, i);
				} 
				i.ownerCt = this;
				i.renderTo(this.el);
			});
		} else if (spec.html) {
			this.html = spec.html ?? '';
			delete spec.html;
			
			if (Bobomb['isFunction'](this.html)) {
				this.el.innerHTML = this.html();
			} else {
				this.el.innerHTML = this.html;
			}
		} else if (spec.text) {
			this.text = spec.text ?? '';
			delete spec.text;
			
			if (Bobomb['isFunction'](this.text)) {
				this.el.textContent = this.text();
			} else {
				this.el.textContent = this.text;
			}
		}
		delete spec.items;

		// listeners
		this.listeners = spec.listeners ?? { };
		this.eventListenersStore = { };
		
		Object.entries(this.listeners).forEach(i => {
			const [eventName, cb] = i;
			this.addListener(eventName, cb);
		});
		delete spec.listeners;

		// data binding
		// TODO: further work here
		// https://johnresig.com/blog/javascript-micro-templating/#postcomment
		/*if (spec.data) {
			//console.log(spec.data)
			Bobomb['watch'](spec.data, function() {

			});
		}
		delete spec.data;*/

		//
		// any other dynamic attrs
		//
		Object.entries(spec).forEach(i => {
			var [key, value] = i;

			// cleanup any JS reserved words
			//	- cls is handled above but put it here for reminding
			if (key === 'cls') { key = 'class'; }

			// filter out defaults object
			if (key != 'defaults') {
				try {
					this.el.setAttribute(key.toString().trim(), value.toString().trim());
				} catch(e) { console.log(e,key,value); }
			}
		});
		
		this.emitEvent('_render');
	}

	// add an event listener and keep track
	addListener(eventName, cb) {
		var eventAddedTS = Date.now().toString();
		if (!this.eventListenersStore[eventName]) {
			this.eventListenersStore[eventName] = {};
		}
		
		this.eventListenersStore[eventName][eventAddedTS] = (evt) => {
			return cb(this, evt);
		};
			
		if (!eventName.startsWith('_')) {	
			this.el.addEventListener(
				eventName, 
				this.eventListenersStore[eventName][eventAddedTS], 
				false
			);
		}
		
		return {
			targetID: this.ID,
			eventName: eventName,
			eventAddedTS: eventAddedTS
		};
	}

	// remove all event listeners
	removeAllListeners() {
		for (var eventName in this.eventListenersStore) {
			for (const eventAddedTS in this.eventListenersStore[eventName]) {
				//console.log('destroying', eventName, eventAddedTS)
				if (!eventName.startsWith('_')) {
					this.el.removeEventListener(
						eventName, 
						this.eventListenersStore[eventName][eventAddedTS], 
						false
					);
				}
				delete this.eventListenersStore[eventName][eventAddedTS];
			}
		}
	}

	removeAllListenersForEvent(eventName) {		
		if (!this.eventListenersStore[eventName]) {
			this.eventListenersStore[eventName] = {};
		}
	
		for (const eventAddedTS in this.eventListenersStore[eventName]) {
			if (!eventName.startsWith('_')) {
				this.el.removeEventListener(
					eventName, 
					this.eventListenersStore[eventName][eventAddedTS], 
					false
				);				
			}
			delete this.eventListenersStore[eventName][eventAddedTS];
		}
	}

	// remove a specific event listener
	removeListener(eventSpec) {
		if (!this.eventListenersStore[eventSpec.eventName]) {
			this.eventListenersStore[eventSpec.eventName] = {};
		}

		if (this.eventListenersStore[eventSpec.eventName][eventSpec.eventAddedTS]) {
			if (!eventSpec.eventName.startsWith('_')) {
				this.el.removeEventListener(
					eventSpec.eventName, 
					this.eventListenersStore[eventSpec.eventName][eventSpec.eventAddedTS], 
					false
				);
			}
			delete this.eventListenersStore[eventSpec.eventName][eventSpec.eventAddedTS];
		}
	}

	emitEvent(eventName, data) {
		//https://developer.mozilla.org/en-US/docs/Web/Events/Creating_and_triggering_events
		if (eventName.startsWith('_')) {
			for (const eventAddedTS in this.eventListenersStore[eventName]) {
				this.eventListenersStore[eventName][eventAddedTS](this, data);
			}
		} else {
			this.el.dispatchEvent(
				new CustomEvent(eventName, data)
			);
		}
	}

	// render component to an element
	renderTo(targetEl) {
		this.emitEvent('_beforelayout');
		
		if (Bobomb['isString'](targetEl)) {
			targetEl = document.querySelector(targetEl);
		}

		if (targetEl) {
			targetEl.appendChild(this.el);
		}

		this.emitEvent('_layout');
		return this;
	}

	// update an attribute or the innerhtml of a component
	update(key, value) {
		if (!value || key == 'html') {
			this.el.innerHTML = key ?? value;
			return this;
		}
		
		// TODO: handle other things that
		// are not just attributes (cls, layout, ID, etc...)
		// that would require further work
		this.el.setAttribute(key, value);

		return this;
	}

	// set/update style of a component
	setStyle(value, merge) {
		if (merge) {
			value = Bobomb['extend'](this.getStyle(), value);
		}
		this.el.setAttribute('style', Bobomb['styleSpecToString'](value));

		return this;
	}

	// update(merge) a new style to a component
	updateStyle(value) {
		return this.setStyle(value, true);
	}

	// get style of component
	getStyle() {
		var t = this.el.getAttribute('style');
		var res = { };
		t.split(';').forEach(i => {
			if (i.trim() != '') {
				var x = i.split(':');
				if (x.length == 2) {
					res[x[0].trim()] = x[1].trim();
				}
			}
		});

		return res;
	}

	// select a child of this component
	down(targetElSelector) {
		var downEl = null;

		if (!targetElSelector) { 
			downEl = this.el.firstChild;
		} else {
			downEl = this.el.querySelector(targetElSelector);
		}

		if (downEl) {
			return Bobomb['componentStore']['get'](downEl.getAttribute('id'));
		} else {
			return null;
		}
	}

	// select a parent of this component
	up(targetElSelector) {
		if (!targetElSelector) { return this.ownerCt; }
		var upEl = this.el.closest(targetElSelector);

		if (upEl) {
			return Bobomb['componentStore']['get'](upEl.getAttribute('id'));
		} else {
			return null;
		}
	}

	// get the DOM element of this component
	getEl() {
		return this.el;
	}

	getID() {
		return this.el.getAttribute('id');
	}

	// get the direct parent of this component (shorthand method)
	getParent() {
		return this.ownerCt;
	}
	
	*getChildrenGenerator() {
		var t = Array.from(this.el.children);
		for (var x of t) {
			var domID = x.getAttribute('id');
			if (domID) {
				if (Bobomb['componentStore']['exists'](domID)) {
					yield Bobomb['componentStore']['get'](domID);
				}
			}
		}
	}
	
	getChildren() {
		return Array.from(this.getChildrenGenerator());
	}
	
	destroy() {
		for (var x of this.getChildren()) {
			x.destroy();
		}
		
		this.getEl().remove();
		
		this.emitEvent('_destroy');
		this.removeAllListeners();
		Bobomb['componentStore'].remove(this.id);
	}
	
	addComponents(spec) {
		if (!Array.isArray(spec)) {
			spec = [spec];
		}
		
		spec.forEach(i => {
			if (!i._isBobombManaged) {
				var targetType = i.xtype ?? 'component';
				// uppercase the first letter in "xtype"
				targetType = targetType[0].toUpperCase() + targetType.toLowerCase().slice(1);
				delete i.xtype;
				// apply any defaults if needed
				i = Bobomb['extend'](i, /*spec.defaults ??*/ { });
				// create and reassign 'i'
				i = Bobomb['create'](`Bobomb.Components.${targetType}`, i);
			} 
			i.ownerCt = this;
			i.renderTo(this.el);			
		});
	}
};

export default Bobomb;