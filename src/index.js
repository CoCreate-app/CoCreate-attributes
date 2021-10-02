/*global CoCreate, CustomEvent*/

import {
	elStore,
	// parseCssRules,
	renderOptions,
	setStyleIfDif,
	setAttributeIfDif,
	setStyleClassIfDif,
	getCoCreateStyle,
	toCamelCase,
	parseUnit,
	// rgba2hex
}
from './common.js';

import observer from '@cocreate/observer';
import crdt from '@cocreate/crdt';
import message from '@cocreate/message-client';
import action from '@cocreate/action';
import pickr from '@cocreate/pickr';
import { containerSelector as ccSelectSelector } from '@cocreate/select/src/config';

let cache = new elStore();

let initDocument = document;

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
		let { element, type, property, camelProperty } = await parseInput(input, el);
		if(!element) return;
		updateInput({ input, element, type, property, camelProperty, isColl: true });

		// ToDo: if input has a value updateElement, need to be catious with observer target update input may have previousvalue
		if(!el && value) {
			updateElement({ input, element, type, property, camelProperty, isColl: true });
		}
	}
	catch(err) {

	}
}

async function parseInput(input, element) {
	if(!element) {
		let selector = input.getAttribute("attribute-target");
		if(selector.indexOf(';') !== -1) {
			await complexSelector(selector,
				(canvasDoc, selector) => element = canvasDoc.querySelector(selector));
		}
		else
			element = initDocument.querySelector(selector);
	}

	if(!element) return;

	let type = input.getAttribute("attribute");
	if(!type) type = 'class';
	type = type.toLowerCase();

	let camelProperty, property = input.getAttribute("attribute-property");
	if(property) {
		camelProperty = toCamelCase(property);
		property = property.toLowerCase();
	}

	return { element, type, property, camelProperty };
}

function initEvents() {
	initDocument.addEventListener("input", inputEvent);
	message.listen("ccStyle", (args) => listen(args));
	observerElements(initDocument.defaultView);
}

async function inputEvent(e) {
	let input = e.target;
	let { element, type, property, camelProperty } = await parseInput(input);
	updateElement({ input, element, type, property, camelProperty, isColl: true });
}


async function listen({
	value,
	unit,
	type,
	property,
	camelProperty,
	elementId,
	elementSelector
}) {


	let selector = property ? `[attribute="${type}"][attribute-property="${property}"]` : `[attribute="${type}"]`;

	let input = initDocument.querySelector(selector);
	if(!input) console.error('input can not be found');
	let element = await complexSelector(elementSelector,
		(canvasDoc, selector) => canvasDoc.querySelector(selector));
	if(!element) console.error('element can not be found');
	updateElement({ type, property, camelProperty, input, element, collValue: value, unit, isColl: false });
}

function collaborate({
	element,
	...rest
}) {
	let elementId = element.getAttribute('element_id');
	if(!elementId)
		return console.warn('no element id, collaboration skiped');
	let elementSelector = rest.input.getAttribute('attribute-target');

	message.send({
		broadcast_sender: false,
		rooms: "",
		emit: {
			message: "ccStyle",
			data: {
				...rest,
				elementId,
				elementSelector
			},

		},
	});
}

function observerElements(initWindow) {
	initWindow.parent.CoCreate.observer.init({
		name: 'ccAttribute',
		observe: ["attributes"], // "characterData"
		callback: (mutation) => {
			if (mutation.attributeName != "attribute-unit") return;
			let inputs = getInputFromElement(mutation.target);
			initElements(inputs, mutation.target);
		},
	});
	observerInit.set(initWindow);
}

function getInputFromElement(element) {
	let elId = element.getAttribute('element_id') || element.id && '#' + element.id;
	if(elId)
		return initDocument.querySelectorAll(`[attribute-target="${elId}"]`);
	return [];
}

function removeZeros(str) {
	let i = 0;
	for(let len = str.length; i < len; i++) {
		if(str[i] !== '0')
			break;
	}
	return str.substr(i) || str && '0';
}

async function updateElement({ input, element, collValue, isColl, unit, type, property, camelProperty, ...rest }) {
	if (!element) {
		 let parsed = await parseInput(input);
		 element = parsed.element;
		 type = parsed.type; 
		 property = parsed.property;
		 camelProperty = parsed.camelProperty;
	}
	let inputValue = collValue != undefined ? collValue : getInputValue(input);
	if(!inputValue) return;

	if(!Array.isArray(inputValue)) {
		inputValue = unit && inputValue ? inputValue + unit : inputValue;
		inputValue = removeZeros(inputValue);
	}
	else
		inputValue.forEach(a => removeZeros(a.value));

	let hasUpdated = updateElementValue({ ...rest, type, property, camelProperty, input, element, inputValue, hasCollValue: collValue != undefined });

	cache.reset(element);

	hasUpdated && isColl && collaborate({
		value: inputValue,
		unit: input.getAttribute('attribute-unit'),
		input,
		element,
		type,
		property,
		...rest
	});
	
	let types = ['attribute', 'classstyle', 'style', 'innerText'];
	if(!types.includes(type)) {
		property = type;
		type = 'attribute';
	}

	let value;
	let item;
	if(Array.isArray(inputValue)) {
		if (!inputValue.length) return;
		if(property === 'class')
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
		let domTextEditor = element.closest('[contenteditable]')
		if(domTextEditor && CoCreate.text) {
			try {
				let target = element.getAttribute("element_id");
				unit = input.getAttribute('attribute-unit') || '';
				switch(type) {
					case 'attribute':
						CoCreate.text.setAttribute({ domTextEditor, target, name: property, value });
						break;
					case 'classstyle':
						CoCreate.text.setClassStyle({ domTextEditor, target, classname: property, value, unit });
						break;
					case 'style':
						CoCreate.text.setStyle({ domTextEditor, target, styleName: property, value, unit });
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
	hasUpdated &&
		isColl &&
		initDocument.dispatchEvent(new CustomEvent('attributes', {
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

function updateElementValue({ type, property, camelProperty, input, element, inputValue, hasCollValue }) {
	let computedStyles, value, removeValue, hasUpdated, unit, parsedInt;
	switch(type) {

		case 'classstyle':
			unit = (input.getAttribute('attribute-unit') || '');
			inputValue = Array.isArray(inputValue) ? inputValue.value : inputValue;
			// ToDo: process the inputValue array to return a string array of values
			// if (Array.isArray(inputValue)){
			//     inputValue = ;
			// }
			value = inputValue && !hasCollValue ? inputValue + unit : inputValue;
			value = value || '';
			computedStyles = getRealStaticCompStyle(element);
			return setStyleClassIfDif(element, {
				property,
				camelProperty,
				value,
				computedStyles
			})

		case 'style':
			unit = (input.getAttribute('attribute-unit') || '');
			inputValue = Array.isArray(inputValue) ? inputValue.value : inputValue;
			value = inputValue && !hasCollValue ? inputValue + unit : inputValue;
			value = value || '';
			computedStyles = getRealStaticCompStyle(element);
			return setStyleIfDif.call(element, { property, camelProperty, value, computedStyles })

		case 'innerText':
			if(element.innerText != inputValue) {
				element.innerText = inputValue;
				return true;
			}
			else return false;
			// default is setAttribute
		default:
			if(typeof inputValue == 'string') {

				return setAttributeIfDif.call(element, type, inputValue)
			}
			else {
				if(!inputValue.length)
					return setAttributeIfDif.call(element, type, '')
				else if(type === "class") {
					value = inputValue.map(o => o.value).join(' ')
					return setAttributeIfDif.call(element, type, value)
				}
				else
					for(let inputSValue of inputValue) {
						if(inputSValue.checked) {
							return setAttributeIfDif.call(element, type, inputSValue.value)

						}
						else if(element.hasAttribute(type)) {
							element.removeAttribute(type)
							return true;
						}

					}

			}

			break;
	}
}


function updateInput({ type, property, camelProperty, element, input }) {
	let computedStyles, value, value2, styleValue, unit;
	if(!input) return console.error('CoCreate Attributes: input not found/dev')
	switch(type) {
		case 'class':
			value = Array.from(element.classList);
			break;
		case 'classstyle':
			let ccStyle = getCoCreateStyle(element.classList);
			if(ccStyle[camelProperty])
				value2 = ccStyle[camelProperty];
			else {
				computedStyles = getRealStaticCompStyle(element);
				value2 = computedStyles[camelProperty];
			}
			if(!value2) {
				return console.warn(`"${property}" can not be found in style object`);
			}
			([styleValue, unit] = parseUnit(value2));
			value = styleValue;
			setAttributeIfDif.call(input, "attribute-unit", unit);
			break;
		case 'style':
			computedStyles = getRealStaticCompStyle(element);
			value2 = computedStyles[camelProperty];
			if(!value2) {
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

	let inputType = input.classList.contains('pickr') && 'pickr' ||
		input.matches(ccSelectSelector) && 'cocreate-select' ||
		input.tagName.toLowerCase();

	switch(inputType) {
		case 'input':
			switch(input.type) {
				case 'checkbox':
				case 'radio':
					input.checked = value == input.value ? true : false;
					break;
				default:
					if(input.getAttribute('crdt') == 'true')
						crdt.replaceText({
							collection: input.getAttribute('collection'),
							document_id: input.getAttribute('document_id'),
							name: input.getAttribute('name'),
							value: value + '',
						});
					else
						input.value = value + '';
			}
			break;
			// case "textarea":
			//     input.value = value;
			//     break;
		case 'select':
			let options = Array.from(input.options);
			options.forEach(option => {
				if(value == option.value)
					input.selectedIndex = options.indexOf(option);
			});
			break;
		case 'cocreate-select':
			if(value)
				value = Array.isArray(value) ? value : [value];
			else
				value = [];
			renderOptions(input, value);
			break;
		case 'pickr':
			// todo: how to perform validation
			let pickrIns = pickr.refs.get(input);

			pickrIns.setColor(value); // todo: style or value

			break;
		default:
			if(input.getAttribute('crdt') == 'true')
				crdt.replaceText({
					collection: input.getAttribute('collection'),
					document_id: input.getAttribute('document_id'),
					name: input.getAttribute('name'),
					value: value + '',
				});
			else
				input.value = value + '';
	}
}

function packMultiValue({
	inputs,
	stateProperty,
	valueProperty = "value",
	forceState,
}) {
	let value = [];
	Array.from(inputs).forEach(input => {
		value.push({ checked: forceState || input[stateProperty], value: input[valueProperty] || input.getAttribute(valueProperty) });
	});
	return value;
}

function getInputValue(input) {
	if(!input) return;
	let inputType = input.classList.contains('pickr') && 'pickr' ||
		input.matches(ccSelectSelector) && 'cocreate-select' ||
		input.tagName.toLowerCase();

	switch(inputType) {
		case 'input':
			switch(input.type) {
				case 'checkbox':
				case 'radio':
					return packMultiValue({
						inputs: initDocument.getElementsByName(input.name),
						stateProperty: 'checked',
					});

				default:
					return input.value;

			}

		case "textarea":
			return input.value;

		case 'select':
			return packMultiValue({
				inputs: input.options,
				stateProperty: 'selected'
			});

		case 'cocreate-select':
			return packMultiValue({
				inputs: input.selectedOptions,
				forceState: true
			});

		case 'pickr':
			// todo: how to perform validation
			// if (!CoCreate.pickr.refs.has(input)) return; 
			let pickrIns = pickr.refs.get(input);
			return pickrIns ? pickrIns.getColor() : '';

		default:
			let value = input.getAttribute('value');
			if (value) return value;
			return false;
	}
}

function getRealStaticCompStyle(element) {
	if(cache.get(element, 'valid'))
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
	if(element.getAttribute("style") == "") element.removeAttribute("style");
	element.removeAttribute('no-observe');
	cache.spread(element, { computedStyles, valid: true });
	return computedStyles;
}


let observerInit = new Map();

async function complexSelector(comSelector, callback) {
	let [canvasSelector, selector] = comSelector.split(';');
	let canvas = document.querySelector(canvasSelector);
	if(!canvas) {
		console.warn('complex selector canvas now found for', comSelector);
		return;
	}

	if(canvas.contentDocument.readyState === 'loading') {
		try {
			await new Promise((resolve, reject) => {
				canvas.contentWindow.addEventListener('load', (e) => resolve());
			});
		}
		catch(err) {
			console.error('iframe can not be loaded');
		}
	}

	if(canvas.contentWindow.parent.CoCreate.observer && !observerInit.has(canvas.contentWindow)) {
		observerElements(canvas.contentWindow);
	}

	return callback(canvas.contentWindow.document, selector);
}

init();

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
	}
});

action.init({
	action: "attributes",
	endEvent: "attributes",
	callback: (btn, data) => {
		updateElement({ input: btn, isColl: true });
	}
});


export default { init };
