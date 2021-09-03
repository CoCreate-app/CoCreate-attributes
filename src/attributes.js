/*global CoCreate*/

import {
    elStore,
    parseCssRules,
    renderOptions,
    setStyleIfDif,
    setAttributeIfDif,
    setStyleClassIfDif,
    getCoCreateStyle,
    toCamelCase,
    parseUnit,
    rgba2hex
}
from './common.js';

import observer from '@cocreate/observer';
import crdt from '@cocreate/crdt';
import pickr from '@cocreate/pickr';
import message from '@cocreate/message-client';
import { containerSelector as ccSelectSelector } from '@cocreate/select/src/config';
import { container } from '@cocreate/select';


let cache = new elStore();
let types = ['attribute', 'classstyle', 'style', 'innerText']

function attributes({ document: initDocument, exclude = "", callback = () => {} }) {
    this.exclude = exclude ? `:not(${exclude})` : '';
    // this.callback will be called by type which can be "attribute" "classstyle" "style" "innertext"
    this.callback = callback;
    this.initDocument = initDocument;

}


attributes.prototype.init = function init() {

    this.scanNewElement();
    observer.init({
        name: "ccAttribute",
        observe: ["attributes"],
        target: "input, .pickr, cocreate-select",
        attributeName: ["attribute-target", "value", "attribute-unit"],
        callback: async m => await this.watchInputChange(m),
    });
    // this.initDocument.addEventListener("input", element);
    this.initDocument.addEventListener("input", async(e) => {
        let input = e.target;
        this.perInput(input, (inputMeta, element) =>
            this.updateElement({ ...inputMeta, input, element, isColl: true }));
    });

    // observer elements change to reflect inputs (data-units)
    this.observerElements(this.initDocument.defaultView);

    message.listen("ccStyle", (args) => this.listen(args));

};

function element(e) {
    let self = this;
    let input = e.target;
    self.perInput(input, (inputMeta, element) =>
        self.updateElement({ ...inputMeta, input, element, isColl: true }));
};


attributes.prototype.listen = async function listen({
    value,
    unit,
    type,
    property,
    camelProperty,
    elementId,
    elementSelector
}) {


    let selector = property ? `[attribute="${type}"][attribute-property="${property}"]${this.exclude}` : `[attribute="${type}"]${this.exclude}`;

    let input = this.initDocument.querySelector(
        selector
    );
    if (!input) console.error('input can not be found')
    // if (selector.indexOf(';') !== -1)
    // let element
    let element = await this.complexSelector(elementSelector,
        (canvasDoc, selector) => canvasDoc.querySelector(selector));
    // else
    //     element = this.initDocument.querySelector(elementSelector)
    if (!element) console.error('element can not be found')
    this.updateElement({ type, property, camelProperty, input, element, collValue: value, unit, isColl: false })


}

attributes.prototype.collaborate = function collaborate({
    element,
    ...rest
}) {
    // if (value != input.value) return;
    let elementId = element.getAttribute('element_id');
    if (!elementId)
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

attributes.prototype.scanNewElement = function scanNewElement() {
    this.initDocument.querySelectorAll(`[attribute]${this.exclude}`).forEach(async(input) => {
        this.perInput(input, (inputMeta, element) =>
            this.updateInput({ ...inputMeta, input, element, isColl: true }))
    });
}

attributes.prototype.observerElements = function observerElements(initWindow) {
    // initWindow.CoCreate.observer.init({
    // let observer = initWindow.CoCreate.observer ?
    initWindow.parent.CoCreate.observer.init({
        name: 'ccAttribute',
        observe: ["attributes" ], // "characterData"
        callback: (mutation) => {
         
            
            let element = mutation.target;

            this.getInputFromElement(element).forEach(input => {
                let inputMeta = this.validateInput(input);
                if (!inputMeta) return;
                this.updateInput({ ...inputMeta, input, element });
            })

        },
    });
}

//convention based (all elements should use data-elememet_id and it's faster)
// made it also support "id"
attributes.prototype.getInputFromElement = function getInputFromElement(element) {

    let elId = element.getAttribute('element_id') || element.id && '#'+element.id;
    if (elId)
        return this.initDocument.querySelectorAll(`[attribute-target="${elId}"]`);
    return [];

};

attributes.prototype.watchInputChange = async function watchInputChange(mutation) {
    try {
        let element, input = mutation.target;
        let inputMeta = this.validateInput(input);

        element = inputMeta && await this.getElementFromInput(input);

        if (!element) return;

        if (mutation.attributeName === "attribute-target") {
            // if (element) 
            this.updateInput({ ...inputMeta, input, element });
            // element.isFirst = element.isFirst === true ? false : true;
        }
        else if (mutation.attributeName === "attribute-unit") {
            // if (element.isFirst) return;
            this.updateElement({ ...inputMeta, input, element, isColl: true });
        }
    }
    catch (err) {

    }

}


attributes.prototype.perInput = async function perInput(input, callback) {

    let inputMeta, element;
    inputMeta = this.validateInput(input);
    element = inputMeta && await this.getElementFromInput(input);
    if (!element) return;
    callback(inputMeta, element)

}




attributes.prototype.validateInput = function validateInput(input) {
    let type = input.getAttribute("attribute");
    if (!type) {
        // console.warn("cc-style: input doesn't have attribute")
        return;
    }
    type = type.toLowerCase();


    let camelProperty, property = input.getAttribute("attribute-property");
    if (property) {
        camelProperty = toCamelCase(property);
        property = property.toLowerCase();
    }


    return {
        type,
        property,
        camelProperty,

    };
}


attributes.prototype.updateElementByValue = function updateElementByValue({ type, property, camelProperty, input, element, inputValue, hasCollValue }) {
    let computedStyles, value, removeValue, hasUpdated, unit, parsedInt;
    switch (type) {



        case 'classstyle':
            unit = (input.getAttribute('attribute-unit') || '');
            inputValue = Array.isArray(inputValue) ? inputValue.value : inputValue;
            // ToDo: process the inputValue array to return a string array of values
            // if (Array.isArray(inputValue)){
            //     inputValue = ;
            // }
            value = inputValue && !hasCollValue ? inputValue + unit : inputValue;
            value = value || '';
            computedStyles = this.getRealStaticCompStyle(element);
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
            computedStyles = this.getRealStaticCompStyle(element);
            return setStyleIfDif.call(element, { property, camelProperty, value, computedStyles })

        case 'innerText':
            if (element.innerText != inputValue) {
                element.innerText = inputValue;
                return true;
            }
            else return false;
            // default is setAttribute
        default:
            if (typeof inputValue == 'string') {

                return setAttributeIfDif.call(element, type, inputValue)
            }
            else {
                if (!inputValue.length)
                    return setAttributeIfDif.call(element, type, '')
                else if (type === "class") {
                    value = inputValue.map(o => o.value).join(' ')
                    return setAttributeIfDif.call(element, type, value)
                }
                else
                    for (let inputSValue of inputValue) {
                        if (inputSValue.checked) {
                            return setAttributeIfDif.call(element, type, inputSValue.value)

                        }
                        else if(element.hasAttribute(type))
                        {   
                            element.removeAttribute(type)
                            return true; 
                        }

                    }


            }

            break;

    }


}


// attributes.prototype.updateElementByValues = function updateElementByValues({ type, property, camelProperty, input, element, inputValue, hasCollValue }) {
//     let computedStyles, value, removeValue, hasUpdated, unit, parsedInt;
//     switch (type) {



//         case 'classstyle':
//             unit = (input.getAttribute('attribute-unit') || '');
//             inputValue = Array.isArray(inputValue) ? inputValue.value : inputValue;
//             value = inputValue && !hasCollValue ? inputValue + unit : inputValue;
//             value = value || '';
//             computedStyles = this.getRealStaticCompStyle(element);
//             return setStyleClassIfDif(element, {
//                 property,
//                 camelProperty,
//                 value,
//                 computedStyles
//             })


//         case 'style':
//             unit = (input.getAttribute('attribute-unit') || '');
//             inputValue = Array.isArray(inputValue) ? inputValue.value : inputValue;
//             value = inputValue && !hasCollValue ? inputValue + unit : inputValue;
//             value = value || '';
//             computedStyles = this.getRealStaticCompStyle(element);
//             return setStyleIfDif.call(element, { property, camelProperty, value, computedStyles })

//         case 'innerText':
//             if (element.innerText != inputValue) {
//                 element.innerText = inputValue;
//                 return true;
//             }
//             else return false;
//             // default is setAttribute
//         default:
 
        
//                 if (type === "class") {
//                     value = inputValue.filter(i => i.checked).map(o => o.value).join(' ')
//                     return setAttributeIfDif.call(element, type, value)
//                 }
//                 else
//                     for (let inputSValue of inputValue) {
//                         if (inputSValue.checked) {
//                             return setAttributeIfDif.call(element, type, inputSValue.value)

//                         }
//                         else if(element.hasAttribute(type))
//                         {   
//                             element.removeAttribute(type)
//                             return true; 
//                         }

//                     }

//                         return setAttributeIfDif.call(element, type, '')
                    
           
//             break;

//     }

// }

attributes.prototype.removeZeros = function removeZeros(str) {
    let i = 0;
    for (let len = str.length; i < len; i++) {
        if (str[i] !== '0')
            break;
    }
    return str.substr(i) || str && '0';
}

attributes.prototype.updateElement = function updateElement({ input, element, collValue, isColl, unit, type, property, ...rest }) {



    let inputValue = collValue != undefined ? collValue : this.getInputValue(input);
    if (!inputValue) return;

    if (!Array.isArray(inputValue)) {
        inputValue = unit && inputValue ? inputValue + unit : inputValue;
        inputValue = this.removeZeros(inputValue)
    }
    else
        inputValue.forEach(a => this.removeZeros(a.value))

    let hasUpdated = this.updateElementByValue({ ...rest, type, property, input, element, inputValue, hasCollValue: collValue != undefined })

    cache.reset(element)

    // attribute is default when it's not attribute



    hasUpdated &&
        isColl &&
        this.collaborate({
            value: inputValue,
            unit: input.getAttribute('attribute-unit'),
            input,
            element,
            type,
            property,
            ...rest,

        });
    if (!types.includes(type)) {
        property = type;
        type = 'attribute';
    }

    let value;
    if (Array.isArray(inputValue)) {
        if (property === 'class')
            value = inputValue.map(o => o.value).join(' ')
        else
            value = inputValue[0].value
    }
    else
        value = inputValue;


    hasUpdated &&
        isColl &&
        this.callback({
            value,
            unit: input.getAttribute('attribute-unit'),
            input,
            element,
            type,
            property,
            ...rest,

        });

}

attributes.prototype.updateInput = function updateInput({ type, property, camelProperty, element, input }) {
    let computedStyles, value, value2, styleValue, unit;
    if (!input) return console.error('CoCreate Attributes: input not found/dev')
    switch (type) {
        case 'class':
            value = Array.from(element.classList);
            break;
        case 'classstyle':
            let ccStyle = getCoCreateStyle(element.classList);
            if (ccStyle[camelProperty])
                value2 = ccStyle[camelProperty];
            else {
                computedStyles = this.getRealStaticCompStyle(element);
                value2 = computedStyles[camelProperty];
            }
            if (!value2) {
                return console.warn(`"${property}" can not be found in style object`)
            }
            ([styleValue, unit] = parseUnit(value2));
            value = styleValue;
            setAttributeIfDif.call(input, "attribute-unit", unit);
            break;
        case 'style':
            computedStyles = this.getRealStaticCompStyle(element);
            value2 = computedStyles[camelProperty];
            if (!value2) {
                return console.warn(`"${property}" can not be found in style object`)
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

    this.setInputValue(input, value != undefined ? value : '');

}

attributes.prototype.setInputValue = function setInputValue(input, value) {
    // console.log(input.getAttribute('name'))

    let inputType = input.classList.contains('pickr') && 'pickr' ||
        input.matches(ccSelectSelector) && 'cocreate-select' ||
        input.tagName.toLowerCase();

    switch (inputType) {
        case 'input':
            switch (input.type) {
                case 'checkbox':
                case 'radio':
                    input.checked = value == input.value ? true : false;
                    break;
                default:
                    if(window.CoCreate.text)
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
            let options = Array.from(input.options)
            options.forEach(option => {
                if (value == option.value)
                    input.selectedIndex = options.indexOf(option);
            })
            break;
        case 'cocreate-select':
            if (value)
                value = Array.isArray(value) ? value : [value]
            else
                value = []
            renderOptions(input, value)
            break;
        case 'pickr':
            // todo: how to perform validation
            let pickrIns = pickr.refs.get(input);

            pickrIns.setColor(value); // todo: style or value
          
            break;
        default:
        if(window.CoCreate.text)
            crdt.replaceText({
                collection: input.getAttribute('collection'),
                document_id: input.getAttribute('document_id'),
                name: input.getAttribute('name'),
                value: value + '',
            });
        else
            input.value = value + '';
    }
};




attributes.prototype.packMultiValue = function packMultiValue({
    inputs,
    stateProperty,
    valueProperty = "value",
    forceState,
}) {
    let value = [];
    Array.from(inputs).forEach(input => {
        value.push({ checked: forceState || input[stateProperty], value: input[valueProperty] || input.getAttribute(valueProperty) })
    })
    return value;
}

attributes.prototype.getInputValue = function getInputValue(input) {
    if (!input) return;
    let inputType = input.classList.contains('pickr') && 'pickr' ||
        input.matches(ccSelectSelector) && 'cocreate-select' ||
        input.tagName.toLowerCase();

    switch (inputType) {
        case 'input':
            switch (input.type) {
                case 'checkbox':
                case 'radio':
                    return this.packMultiValue({
                        inputs: this.initDocument.getElementsByName(input.name),
                        stateProperty: 'checked',
                    });

                default:
                    return input.value;

            }

        case "textarea":
            return input.value;

        case 'select':
            return this.packMultiValue({
                inputs: input.options,
                stateProperty: 'selected'
            })

        case 'cocreate-select':
            return this.packMultiValue({
                inputs: input.selectedOptions,
                forceState: true
            });

        case 'pickr':
            // todo: how to perform validation
            // if (!CoCreate.pickr.refs.has(input)) return; 
            let pickrIns = pickr.refs.get(input);
            return pickrIns ? pickrIns.getColor() : '';



        default:
            return false;
            console.warn('CoCreateStyle: unidentified input');
            break;
    }


}



attributes.prototype.getElementFromInput = async function getElementFromInput(input) {
    let id = input.getAttribute("attribute-target");

    if (id) {
        if (id.indexOf(';') !== -1) {
            let el = await this.complexSelector(id,
                (canvasDoc, selector) => canvasDoc.querySelector(selector));
            return el;
        }
        else
            return this.initDocument.querySelector(id)
    }
    else
        return false;

}



attributes.prototype.getRealStaticCompStyle = function getRealStaticCompStyle(element) {
    if (cache.get(element, 'valid'))
        return cache.get(element, 'computedStyles');
    setTimeout(() => {
        cache.reset(element)
    }, 5000);
    let oldDispaly = element.style.display;
    element.style.display = "none";
    let computedStylesLive = window.getComputedStyle(element);
    let computedStyles = Object.assign({}, computedStylesLive);
    computedStyles.display = oldDispaly;

    element.style.display = oldDispaly;
    if (element.getAttribute("style") == "") element.removeAttribute("style");
    element.removeAttribute('no-observe')
    cache.spread(element, { computedStyles, valid: true })
    return computedStyles;
}


let observerInit = new Map();
attributes.prototype.complexSelector = async function complexSelector(comSelector, callback) {
    let [canvasSelector, selector] = comSelector.split(';');
    let canvas = document.querySelector(canvasSelector);
    if (!canvas) {
        console.warn('complex selector canvas now found for', comSelector)
        return
    }

    if (  canvas.contentDocument.readyState === 'loading') {
        try {
            await new Promise((resolve, reject) => {
                canvas.contentWindow.addEventListener('load', (e) => resolve())
            });
        }
        catch (err) {
            console.error('iframe can not be loaded')
        }
        // this.observerElements(canvas.contentWindow)
        // canvas.contentWindow.observedByCCAttributes = true;
    }
    
    /*!canvas.contentWindow.observedByCCAttributes &&*/
    // if(CoCreate.observer) {
        if(canvas.contentWindow.parent.CoCreate.observer && !observerInit.has(canvas.contentWindow)) {
            this.observerElements(canvas.contentWindow)
            observerInit.set(canvas.contentWindow)
            
        }
    // }
    
    return callback(canvas.contentWindow.document, selector);
};

export default {
    init: (params) => {
        let s = new attributes(params)
        s.init();
        return s;
    }
};
