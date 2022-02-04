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
    if (object && object.__proxy__) {
         return object;
    }

    var proxy = new Proxy(object, {
        get: function(object, name) {
            if (name == '__proxy__') {
                return true;
            }
            return object[name];
        },
        set: function(object, name, value) {
            var old = object[name];
            if (value && typeof value == 'object') {
                // new object need to be proxified as well
                value = proxify(value, change);
            }
            object[name] = value;
            change(object, name, old, value);
        }
    });

    for (var prop in object) {
        if (object.hasOwnProperty(prop) && object[prop] &&
            typeof object[prop] == 'object') {
            // proxify all child objects
            object[prop] = proxify(object[prop], change);
        }
    }
    return proxy;
};

// https://stackoverflow.com/questions/384286/how-do-you-check-if-a-javascript-object-is-a-dom-object?page=1&tab=votes#tab-top
Bobomb['isElement'] = function (el) {
    return el instanceof Element || el instanceof HTMLDocument;  
};

//https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
Bobomb['generateUUID'] = function() {
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
};

Bobomb['styleSpecToString'] = function(spec) {
	if (typeof spec == 'string') {
		return spec;
	}

	var style = [];
	Object.entries(spec).forEach(i => {
		const [key, value] = i;
		style.push(`${key}: ${value}`)
	});

	return style.join(';');
};

Bobomb['componentStore'] = {
	store: { },
	register: (ID, ref) => {
		ref._isBobombManaged = true;
		Bobomb['componentStore']['store'][ID] = ref;
		return ID;
	},
	get: (ID) => {
		return Bobomb['componentStore']['store'][ID];
	}
};
Bobomb['getComponent'] = Bobomb['componentStore']['get'];
//

Bobomb.ns('Bobomb.Components')['Component'] = class {
	tagName = '';
	id = '';
	el = null;
	listeners = { };
	ownerCt = null;
	internalID = null;
	_isBobombManaged = false;

	constructor(spec) {
		this.tagName = spec.tagName ?? 'div';
		this.id = spec.id ?? Bobomb['generateUUID']();
		this.html = spec.html ?? '';
		this.listeners = spec.listeners ?? { };

		delete spec.tagName;
		delete spec.id;
		delete spec.html;
		delete spec.listeners;

		// creation
		this.el = document.createElement(this.tagName);

		// id set
		this.el.setAttribute('id', this.id);
		Bobomb['componentStore']['register'](this.id, this);

		// base attrs
		this.el.setAttribute('style', Bobomb['styleSpecToString'](spec.style ?? ''));
		delete spec.style;

		// inner 
		if (spec.items) {
			spec.items.forEach(i => {
				if (!i._isBobombManaged) {
					var targetType = i.xtype ?? 'component';
					targetType = targetType[0].toUpperCase() + targetType.toLowerCase().slice(1);
					delete i.xtype;
					i = Bobomb['create'](`Bobomb.Components.${targetType}`, i);
				} 
				i.ownerCt = this;
				i.renderTo(this.el);
			});
		} else {
			this.el.innerHTML = this.html;
		}
		delete spec.items;

		// any dynamic other attrs
		Object.entries(spec).forEach(i => {
			const [key, value] = i;
			// cleanup any JS reserved words
			if (key === 'cls') { key = 'class'; }
			this.el.setAttribute(key, value);
		});

		// listeners
		Object.entries(this.listeners).forEach(i => {
			const [key, cb] = i;
			this.el.addEventListener(key, cb.bind(this), false);
		});
	}

	renderTo(targetEl) {
		if (targetEl) {
			targetEl.appendChild(this.el);
		}

		return this.el;
	}

	update(key, value) {
		if (!value || key == 'html') {
			this.el.innerHTML = key ?? value;
		} else {
			this.el.setAttribute(key, value);
		}
		return this;
	}

	setStyle(value, merge) {
		if (merge) {
			value = Bobomb['extend'](this.getStyle(), value);
		}
		this.el.setAttribute('style', Bobomb['styleSpecToString'](value));
		return this;
	}

	getStyle() {
		var t = this.el.getAttribute('style');
		var res = { };
		t.split(';').forEach(i => {
			var x = i.split(':');
			res[x[0].trim()] = x[1].trim();
		});
		return res;
	}

	down(targetElSelector) {
		var downEl = null;
		if (!targetElSelector) { 
			downEl = this.el.firstChild;
		} else {
			downEl = this.el.querySelector(targetElSelector);
		}
		if (downEl) {
			return Bobomb['componentStore']['get'](downEl.getAttribute('id'));
		}
	}

	up(targetElSelector) {
		if (!targetElSelector) { return this.ownerCt; }
		var upEl = this.el.closest(targetElSelector);
		if (upEl) {
			return Bobomb['componentStore']['get'](upEl.getAttribute('id'));
		}
	}
};

//
/*
Bobomb.ns('Bobomb.Components')['Panel'] = class extends HTMLElement {
	constructor(spec) {
		super();
		const shadowRoot = this.attachShadow({mode: 'closed'});
		shadowRoot.innerHTML = `<div></div>`;
	}

	connectedCallback() {
		//console.log('Rating added to DOM');
	}

	disconnectedCallback() {

	}
}
window.customElements.define('box-component', Bobomb.ns('Bobomb.Components')['BoxComponent']);
*/
//

export default Bobomb;