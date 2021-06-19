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

import observer from '@cocreate/observer'
import crdt from '@cocreate/crdt'
import pickr from '@cocreate/pickr'
import message from '@cocreate/message-client';
import { containerSelector as ccSelectSelector } from '@cocreate/select/src/config';
import { container } from '@cocreate/select';

// // dev start
// import '@cocreate/select'
// import selected from '@cocreate/selected'
// import domToText from '@cocreate/domToText'


// selected.config({
//     srcDocument: document,
//     destDocument: document,
//     selector: "#container *",
//     target: "[data-attributes]:not(.styleunit)",
//     callback: (element, target) => {
//         target.setAttribute('data-attributes_target', `[data-element_id=${element.getAttribute('data-element_id')}]`);
//         target.setAttribute('name', target.id + '-' + element.getAttribute('data-element_id'))
//     }
// });






// //profile observer
// let profile = []

// function profileObserver(mutation, extra = {}) {

//     // get time
//     let date = new Date();
//     let time = date.getSeconds() + '.' + date.getMilliseconds()
//     profile.push({ time, ...extra, ...mutation })
// }


// // dev end

let cache = new elStore();
let types = ['attribute', 'classstyle', 'style', 'innerText']

function attributes({ document: initDocument, exclude = "", callback = () => {} }) {
    this.exclude = exclude;
    // this.callback will be called by type which can be "attribute" "classstyle" "style" "innertext"
    this.callback = callback;
    this.initDocument = initDocument;

}


attributes.prototype.init = function init() {


    this.scanNewElement()
    // this.initDocument.defaultView.CoCreate.observer.init({
    observer.init({
        name: "ccAttribute",
        observe: ["attributes"],
        attributeFilter: ["data-attributes_target", "value", "data-attributes_unit"],
        callback: async m => m.target.matches('INPUT, .pickr, cocreate-select') && await this.watchInputChange(m),
    });
    this.initDocument.addEventListener("input", async(e) => {
        let input = e.target;
        // input.tagName == "COCREATE-SELECT" && 
        this.perInput(input, (inputMeta, element) =>
            this.updateElement({ ...inputMeta, input, element, isColl: true }))
    });


    // observer elements change to reflect inputs (data-units)
    this.observerElements(this.initDocument.defaultView);

    message.listen("ccStyle", (args) => this.listen(args));



}


attributes.prototype.listen = async function listen({
    value,
    unit,
    type,
    property,
    camelProperty,
    elementId,
    elementSelector
}) {


    let selector = property ? `[data-attributes="${type}"][data-attributes_property="${property}"]:not(${this.exclude})` : `[data-attributes="${type}"]:not(${this.exclude})`;

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
    let elementId = element.getAttribute('data-element_id');
    if (!elementId)
        return console.warn('no element id, collaboration skiped');
    let elementSelector = rest.input.getAttribute('data-attributes_target');



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
    this.initDocument.querySelectorAll(`[data-attributes]:not(${this.exclude})`).forEach(async(input) => {
        this.perInput(input, (inputMeta, element) =>
            this.updateInput({ ...inputMeta, input, element, isColl: true }))
    });
}
attributes.prototype.observerElements = function observerElements(initWindow) {
    // initWindow.CoCreate.observer.init({
    // let observer = initWindow.CoCreate.observer ?
    initWindow.CoCreate.observer.init({
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


    let elId = element.getAttribute('data-element_id') || element.id && '#'+element.id;
    if (elId)
        return this.initDocument.querySelectorAll(`[data-attributes_target="${elId}"]`)
    return []

}

// todo: discuss with
// attributes.prototype.getInputFromElement = function getInputFromElement(element) {

//     // let inputs = [];

//     //todo: fix add textarea
//     let elId = element.getAttribute('data-element_id');
//     if(elId)
//      this.initDocument.querySelectorAll(`[data-attributes_target]`).forEach

// }

attributes.prototype.watchInputChange = async function watchInputChange(mutation) {
    try {
        // return;
        let element, input = mutation.target;
        let inputMeta = this.validateInput(input);


        element = inputMeta && await this.getElementFromInput(input);

        if (!element) return


        if (mutation.attributeName === "data-attributes_target") {
            // if (element) 
            this.updateInput({ ...inputMeta, input, element });
            // element.isFirst = element.isFirst === true ? false : true;
        }
        else if (mutation.attributeName === "data-attributes_unit") {
            // if (element.isFirst) return;
            this.updateElement({ ...inputMeta, input, element, isColl: true })
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
    let type = input.getAttribute("data-attributes");
    if (!type) {
        // console.warn("cc-style: input doesn't have data-attributes")
        return;
    }
    type = type.toLowerCase();


    let camelProperty, property = input.getAttribute("data-attributes_property");
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
            unit = (input.getAttribute('data-attributes_unit') || '');
            inputValue = Array.isArray(inputValue) ? inputValue.value : inputValue;
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
            unit = (input.getAttribute('data-attributes_unit') || '');
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

                    }


            }

            break;

    }


}


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
            unit: input.getAttribute('data-attributes_unit'),
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
            unit: input.getAttribute('data-attributes_unit'),
            input,
            element,
            type,
            property,
            ...rest,

        });

    // not needed since crdt
    // when function called on collboration
    // todo: use setInputValue directly in updateElementByValue
    // if (newValue) {
    //     updateInput({...rest, element, input, })
    // }

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
            setAttributeIfDif.call(input, "data-attributes_unit", unit);
            break;
        case 'style':
            computedStyles = this.getRealStaticCompStyle(element);
            value2 = computedStyles[camelProperty];
            if (!value2) {
                return console.warn(`"${property}" can not be found in style object`)
            }
            ([styleValue, unit] = parseUnit(value2));
            value = styleValue;
            setAttributeIfDif.call(input, "data-attributes_unit", unit);
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
        // case 'input':
        //     switch (input.type) {
        //         case 'checkbox':
        //         case 'radio':
        //             input.checked = value == input.value ? true : false;
        //             break;
        //         default:
        //             input.value = value;
        //     }
        //     break;
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
            crdt.replaceText({
                collection: 'builder',
                document_id: 'null',
                name: input.getAttribute('name'),
                value: value + '',
                position: '0',
            })
            // console.warn('CoCreateStyle: unidentified input: ', inputType, 'input ', input)
    }
}




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
    return value
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
    let id = input.getAttribute("data-attributes_target");

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
    if(canvas.contentWindow.CoCreate.observer && !observerInit.has(canvas.contentWindow))
    {
        this.observerElements(canvas.contentWindow)
        observerInit.set(canvas.contentWindow)
        
    }
    
    return callback(canvas.contentWindow.document, selector);
}







// attributes.prototype.getInputs = function getInputs(element) {
//     let inputs = [];
//     let allInputs = Array.from(document.getElementsByTagName("input"));
//     allInputs.forEach((inputCandidate) => {
//         let inputMeta = getInputMetaData(inputCandidate);
//         if (!inputMeta) return;

//         let allReferencedEl = allFrame((frame) =>
//             frame.querySelectorAll(
//                 inputMeta.input.getAttribute("data-attributes_target")
//             )
//         );
//         if (Array.from(allReferencedEl).includes(element)) {
//             inputs.push(inputMeta.input);
//         }
//     });
//     return inputs;
// }
//attributes.prototype.perInput =  async function perInput(input, callback) {
//     let inputMeta, element, group = input.getAttribute("data-attributes_group");
//     if (group) {
//         [inputMeta, element] = getInputsMetaData(input);
//     } else {
//         inputMeta = validateInput(input);
//         element = await getElementFromInput(input);
//     }

//     if (!inputMeta || !element) return;

//     if (Array.isArray(inputMeta))
//         inputMeta.forEach(async(metas) => callback(metas, element))
//     else
//         callback(inputMeta, element)
// }

//attributes.prototype.getInputsMetaData =  function getInputsMetaData(input) {
//     let list = [],
//         inputs = [];
//     let element = getElementFromInput(input)
//     let realInputs = input.querySelectorAll(group);
//     realInputs.forEach(inp => {
//         
//         inputs.push(inp)
//         list.push(validateInput(inp))
//     })
//     groupEl.set(input, inputs);
//     return [list, element];
// }



// window.addEventListener('load', () => {
//     let attribute = new attributes({ document, exclude: '#ghostEffect,.vdom-item ',
//       callback: ({
//         value,
//         type,
//         property,
//         element,
//     }) => {
//           if (document.contains(element))
//         domToText.domToText({
//           method: type == 'attribute' ? 'setAttribute' : type, 
//           property: property,
//           target: element.getAttribute("data-element_id"),
//           tagName: element.tagName,
//           value,
//           ...crdtCon
//         })

//     },})
//     attribute.init()
// })

// let s = new attributes({
//     document,
//     exclude: '#ghostEffect,.vdom-item ',
//     callback: ({
//         value,
//         type,
//         property,
//         element,
//     }) => {
//           if (document.contains(element))
//         domToText.domToText({
//           method: type == 'attribute' ? 'setAttribute' : type, 
//           property: property,
//           target: element.getAttribute("data-element_id"),
//           tagName: element.tagName,
//           value,
//           ...crdtCon
//         })

//     },
// })
// s.init();



export default {
    init: (params) => {
        let s = new attributes(params)
        s.init();
        return s;
    }
};
