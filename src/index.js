/*global CoCreate, CustomEvent*/

import {
	elStore,
	setStyleIfDif,
	setAttributeIfDif,
	setStyleClassIfDif,
	getCoCreateStyle,
	toCamelCase,
	parseUnit
}
from './common.js';

import observer from '@cocreate/observer';
import crdt from '@cocreate/crdt';
import uuid from '@cocreate/uuid';
import action from '@cocreate/actions';
import {cssPath} from '@cocreate/utils';

let cache = new elStore();
let containers = new Map();
let initDocument = document;
let initializing;
// let activeElement;

function init() {
	let inputs = document.querySelectorAll(`[attribute-target]`);
	initElements(inputs);
	initEvents();
}

function initElements(inputs, el) {
	for(let input of inputs)
		initElement(input, el);
}

async function initElement(input, el) {
	try {
		// let value = getInputValue(input);
		
		let selector = input.getAttribute("attribute-target");
		if (selector.trim().endsWith(';')){
			addClickEvent(input, selector);
		}
		else{
			if (input.hasAttribute('actions')) 
				return;
			let { element, type, property, camelProperty } = await parseInput(input, el);
			if (!element) return;
			
			if (input.hasAttribute('attribute-trigger'))
				attributeTrigger({input, element, type, property, camelProperty, isColl: false});
			else
				updateInput({ input, element, type, property, camelProperty, isColl: true });
			
			// TODO: if input has a value updateElement, need to be catious with observer target update input may have previousvalue
			if (!el && value) {
				updateElement({ input, element, type, property, camelProperty, isColl: true });
			}
		}
	}
	catch(err) {

	}
}

const triggers = new Map();
function attributeTrigger({input, element, type, property, camelProperty, isColl}){
	let trigger = input.getAttribute('attribute-trigger');
	if (trigger) {
		if (trigger.includes('@')){
			trigger = trigger.replace('@','');
			var [from, to] = trigger.split('-');
			from = parseFloat(from);
			to = parseFloat(to);
		}
	}
	triggers.set(input,  { element, type, property, camelProperty, isColl, from, to});
	let width = document.documentElement.clientWidth;
	if (width >= from && width <= to)
		updateElement({ input, element, type, property, camelProperty, isColl});
	
	const resizeObserver = new ResizeObserver((e) => {
		// let element = e.target;
		for (let [input, { element, type, property, camelProperty, isColl, from, to}] of triggers){
			let width = e[0].contentRect.width
			if (width >= from && width <= to)
				updateElement({ input, element, type, property, camelProperty, isColl});
			}
		}
	);
	resizeObserver.observe(document.documentElement);
	
}

	

function addClickEvent(input, selector) {
	let container;
	let Document;
	if (selector.indexOf(';') !== -1) {
		let [frameSelector, target] = selector.split(';');
		let frame = document.querySelector(frameSelector);
		Document = frame.contentDocument;
		if (target && target != ' ' && frame){
			container = Document.querySelector(target);
	 	}
	 	else if (frame){
	 		container = Document;
	 	}
	}
	else 
		container = document.querySelector(selector);
		
	if (!containers.has(container)){
		let inputs = new Map();
		let containrMap = new Map();
		container.addEventListener('click', elClicked);
		containrMap.set('inputs', inputs);
		containrMap.set('activeElement', '');
		containers.set(container, containrMap);
	}
	if (input.classList.contains('color-picker'))
		getPickr(container);
	else {
		let activeElement = containers.get(container).get('activeElement');
		// if (activeElement)
		input.targetElement = activeElement;
		containers.get(container).get('inputs').set(input, '');
	}
}

function getPickr(container){
	let inputs = document.queryselectorAll('.pickr[attribute][attribute-target]');
	for(let input of inputs) 
		containers.get(container).get('inputs').set(input, '');
}

async function elClicked(e) {
	let inputs = containers.get(e.currentTarget).get('inputs');
	let activeElement = containers.get(e.currentTarget).get('activeElement');
	if (activeElement == e.target) return;
	initializing = e.target;
	containers.get(e.currentTarget).set('activeElement', e.target);
	let eid = e.target.getAttribute('eid');
	for (let [input] of inputs) {
		input.targetElement = e.target;
		if (!eid){
			if (e.target.id){
				eid = e.target.id;
			}
			else {
				eid = uuid.generate(6);
				let domTextEditor;
				if (e.currentTarget.nodeName == '#document') {
					let documentElement = e.currentTarget.documentElement;
					if (documentElement.hasAttribute('contenteditable'))
						domTextEditor = documentElement;
				}
				else if (e.currentTarget.hasAttribute('contenteditable'))
					domTextEditor = e.currentTarget;
				if (domTextEditor) 	
					CoCreate.text.setAttribute({ domTextEditor, target: e.target, name: 'eid', value: eid });
			}
			e.target.setAttribute('eid', eid);
		}
		input.value = '';
		
		let attribute;
		if (input.id) 
			attribute = input.id;
		else 
			attribute = input.getAttribute('attribute-property');
		if (!attribute)
			attribute = input.getAttribute('attribute');
		
		input.setAttribute('name', attribute + '-' + eid);

		let { element, type, property, camelProperty } = await parseInput(input, e.target);
		if (element && !input.hasAttribute('actions')) {
			updateInput({ input, element, type, property, camelProperty, isColl: false });
		}
	}
	initializing = '';
}

async function parseInput(input, element) {
	if (!element) {
		let selector = input.getAttribute("attribute-target");
		if (!selector) return false;
		if (selector.indexOf(';') !== -1) {
			let [frameSelector, target] = selector.split(';');
			let frame = document.querySelector(frameSelector);
			if (frame) {
			 	let Document = frame.contentDocument;
			 	element = Document.querySelector(target);
			}
		}

		else
			element = initDocument.querySelector(selector);
		input.targetElement = element;
	}

	if (!element) 
		return;
	
	let type = input.getAttribute("attribute");
	if (!type) type = 'class';
	type = type.toLowerCase();

	let camelProperty, property = input.getAttribute("attribute-property");
	if (property) {
		camelProperty = toCamelCase(property);
		property = property.toLowerCase();
	}

	return { element, type, property, camelProperty };
}

function initEvents() {
	initDocument.addEventListener("input", inputEvent);
	observerElements(initDocument.defaultView);
}

async function inputEvent(e) {
    if (e.detail && e.detail.skip === true) return;
	let input = e.target;
	if (!input.hasAttribute('attribute')) return;
	let el = input.targetElement;
	if (el && el == initializing) return;
	let { element, type, property, camelProperty } = await parseInput(input, el);
	updateElement({ input, element, type, property, camelProperty, isColl: true });
}

let observerInit = new Map();

function observerElements(initWindow) {
	initWindow.parent.CoCreate.observer.init({
		name: 'ccAttribute',
		observe: ["attributes"], // "characterData"
		callback: (mutation) => {
			if (mutation.attributeName != "attribute-unit") return;
			let inputs = getInputFromElement(mutation.target, mutation.attributeName);
			initElements(inputs, mutation.target);
		},
	});
	observerInit.set(initWindow);
}

function getInputFromElement(element, attribute) {
	let inputs = initDocument.querySelectorAll(`[attribute="${attribute}"]`);
	let matching = [];
	for (let input of inputs){
		let selector = input.getAttribute('attribute-target');
		if (selector && element.matches(selector))
			matching.push(input);
	}
	return matching;
}

function removeZeros(str) {
	let i = 0;
	for(let len = str.length; i < len; i++) {
		if (str[i] !== '0')
			break;
	}
	return str.substring(i) || str && '0';
}

async function updateElement({ input, element, collValue, isColl, unit, type, property, camelProperty, ...rest }) {
	if (element && element == initializing) return;
	if (!element) {
		let e = {target: input};
		inputEvent(e);
		return;	
	}
	let inputValue = collValue != undefined ? collValue : getInputValue(input);
	if (!inputValue) return;

	if (!Array.isArray(inputValue)) {
		inputValue = unit && inputValue ? inputValue + unit : inputValue;
		inputValue = removeZeros(inputValue);
	}
	else
		inputValue.forEach(a => removeZeros(a.value));

	let hasUpdated = updateElementValue({ ...rest, type, property, camelProperty, input, element, inputValue, isColl, hasCollValue: collValue != undefined });

	cache.reset(element);

	let types = ['attribute', 'classstyle', 'style', 'innerText'];
	if (!types.includes(type)) {
		property = type;
		type = 'attribute';
	}

	let value;
	let item;
	if (Array.isArray(inputValue)) {
		if (!inputValue.length) return;
		if (property === 'class')
			value = inputValue.map(o => o.value).join(' ');
		else
			try {
				item = inputValue[0];
				value = item.value;
			} catch (err) {
				console.error(err);
			}
	}
	else
		value = inputValue;
	
	if (hasUpdated && isColl){
		let domTextEditor = element.closest('[contenteditable]');
		if (domTextEditor && CoCreate.text) {
			try {
				let target = element;
				unit = input.getAttribute('attribute-unit') || '';
				switch(type) {
					case 'attribute':
						CoCreate.text.setAttribute({ domTextEditor, target, name: property, value });
						break;
					case 'classstyle':
						CoCreate.text.setClass({ domTextEditor, target, value: `${property}:${value}${unit}` });
						break;
					case 'style':
						CoCreate.text.setStyle({ domTextEditor, target, property, value: `${value}${unit}`});
						break;
					case 'innerText':
						CoCreate.text.setInnerText({ domTextEditor, target, value });
						break;
					case 'class':
						CoCreate.text.setClass({ domTextEditor, target, value });
						break;
	
					default:
						console.error('ccAttribute to domText no action');
				}
			}
			catch(err) { console.log('domText: dom-to-text: ' + err) }
		}
	}
	hasUpdated && isColl && initDocument.dispatchEvent(new CustomEvent('attributes', {
		detail: {
			value,
			unit: input.getAttribute('attribute-unit'),
			input,
			element,
			type,
			property,
			...rest,
		}
	}));
}

function updateElementValue({ type, property, camelProperty, input, element, inputValue, isColl, hasCollValue }) {
	let domTextEditor = element.closest('[contenteditable]');
	if (isColl && domTextEditor && CoCreate.text) return true;
	let computedStyles, value, unit;
	switch(type) {

		case 'classstyle':
			unit = (input.getAttribute('attribute-unit') || '');
			inputValue = Array.isArray(inputValue) ? inputValue.value : inputValue;
			// TODO: process the inputValue array to return a string array of values
			// if (Array.isArray(inputValue)){
			//     inputValue = ;
			// }
			value = inputValue && !hasCollValue ? inputValue + unit : inputValue;
			value = value || '';
			computedStyles = getRealStaticCompStyle(element);
			return setStyleClassIfDif (element, {
				property,
				camelProperty,
				value,
				computedStyles
			});

		case 'style':
			unit = (input.getAttribute('attribute-unit') || '');
			inputValue = Array.isArray(inputValue) ? inputValue.value : inputValue;
			value = inputValue && !hasCollValue ? inputValue + unit : inputValue;
			value = value || '';
			computedStyles = getRealStaticCompStyle(element);
			return setStyleIfDif.call(element, { property, camelProperty, value, computedStyles });

		case 'innerText':
			if (element.innerText != inputValue) {
				element.innerText = inputValue;
				return true;
			}
			else return false;
			// default is setAttribute
		default:
			if (typeof inputValue == 'string') {

				return setAttributeIfDif.call(element, type, inputValue);
			}
			else {
				if (!inputValue.length)
					return setAttributeIfDif.call(element, type, '');
				else if (type === "class") {
					value = inputValue.map(o => o.value).join(' ');
					return setAttributeIfDif.call(element, type, value);
				}
				else
					for(let inputSValue of inputValue) {
						if (inputSValue.checked) {
							return setAttributeIfDif.call(element, type, inputSValue.value);

						}
						else if (element.hasAttribute(type)) {
							element.removeAttribute(type);
							return true;
						}

					}

			}

			break;
	}
}

function updateInput({ type, property, camelProperty, element, input }) {
	let computedStyles, value, value2, styleValue, unit;
	if (!input) return console.error('CoCreate Attributes: input not found');
	switch(type) {
		case 'class':
			value = Array.from(element.classList);
			break;
		case 'classstyle':
			let ccStyle = getCoCreateStyle(element.classList);
			if (ccStyle[camelProperty])
				value2 = ccStyle[camelProperty];
			else {
				computedStyles = getRealStaticCompStyle(element);
				value2 = computedStyles[camelProperty];
			}
			if (!value2) {
				return console.warn(`"${property}" can not be found in style object`);
			}
			([styleValue, unit] = parseUnit(value2));
			value = styleValue;
			setAttributeIfDif.call(input, "attribute-unit", unit);
			break;
		case 'style':
			computedStyles = getRealStaticCompStyle(element);
			value2 = computedStyles[camelProperty];
			if (!value2) {
				return console.warn(`"${property}" can not be found in style object`);
			}
			([styleValue, unit] = parseUnit(value2));
			value = styleValue;
			setAttributeIfDif.call(input, "attribute-unit", unit);
			break;
		case 'innerText':
			value = element.innerText;
			break;
		default:
			value = element.getAttribute(type);
			break;
	}

	setInputValue(input, value != undefined ? value : '');

}

function setInputValue(input, value) {
	if (input.type == 'file') 
		return;
	if (input.getAttribute('crdt') == 'true')
		crdt.replaceText({
			collection: input.getAttribute('collection'),
			document_id: input.getAttribute('document_id'),
			name: input.getAttribute('name'),
			value: value + '',
			save: input.getAttribute('save'),
			crud: input.getAttribute('crud')
		});
	else
		input.setValue(value);
}

function getInputValue(input) {
	if (!input) return;
	let value = input.getValue();
	if (value) return value;
	return false;
}

function getRealStaticCompStyle(element) {
	if (cache.get(element, 'valid'))
		return cache.get(element, 'computedStyles');
	setTimeout(() => {
		cache.reset(element);
	}, 5000);
	let oldDispaly = element.style.display;
	element.style.display = "none";
	let computedStylesLive = window.getComputedStyle(element);
	let computedStyles = Object.assign({}, computedStylesLive);
	computedStyles.display = oldDispaly;

	element.style.display = oldDispaly;
	if (element.getAttribute("style") == "") element.removeAttribute("style");
	element.removeAttribute('no-observe');
	cache.spread(element, { computedStyles, valid: true });
	return computedStyles;
}


init();

observer.init({
	name: "ccAttribute",
	observe: ["childList"],
	target: '[attribute]',
	callback: function(mutation) {
		initElements(mutation.addedNodes);
	}
});

observer.init({
	name: "ccAttribute",
	observe: ["attributes"],
	attributeName: ["attribute-target"],
	callback: function(mutation) {
		initElement(mutation.target);
	}
});

observer.init({
	name: "ccAttribute",
	observe: ["attributes"],
	// attributeName: ["attribute", "attribute-property", "attribute-unit", "value"],
	attributeName: ["attribute-unit"],
	callback: function(mutation) {
		updateElement({ input: mutation.target, isColl: true });
		if (mutation.attributeName != "attribute-unit") return;
			let inputs = getInputFromElement(mutation.target, mutation.attributeName);
		initElements(inputs, mutation.target);
	}
});

action.init({
	name: "attributes",
	endEvent: "attributes",
	callback: (btn, data) => {
		updateElement({ input: btn, isColl: true });
	}
});

export default { init };
