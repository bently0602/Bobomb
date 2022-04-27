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