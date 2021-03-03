/*global CoCreate*/

import {
    elStore,
    parseCssRules,
    renderOptions,
    removeAllSelectedOptions,
    setStyleIfDif,
    setAttributeIfDif,
    setStyleClassIfDif,
    getCoCreateStyle,
    toCamelCase,
    parseUnit,
    rgba2hex
}
from './common.js';






let profile = []

function profileObserver(mutation, extra = {}) {

    // get time
    let date = new Date();
    let time = date.getSeconds() + '.' + date.getMilliseconds()
    profile.push({ time, ...extra, ...mutation })
}





let cache = new elStore();

//todo: refactor to micro requirement
function attributes({ document: initDocument, exclude = "", callback = () => {} }) {
    this.exclude = exclude;
    this.callback = callback;
    this.initDocument = initDocument;

}


attributes.prototype.init = function init() {


    this.scanNewElement()
    this.initDocument.defaultView.CoCreate.observer.init({
        name: "ccStyle",
        observe: ["attributes"],
        attributes: ["data-attributes_target", "value", "data-attributes_unit"],
        include: "INPUT, .pickr, cocreate-select",
        callback: async m => await this.watchInputChange(m),
    });
    this.initDocument.addEventListener("input", async(e) => {
        let input = e.target;
        // input.tagName == "COCREATE-SELECT" && 
        this.perInput(input, (inputMeta, element) =>
            this.updateElement({ ...inputMeta, input, element, isColl: true }))
    });

    this.observerElements(this.initDocument.defaultView);

    CoCreate.socket.listen("ccStyle", (args) => this.listen(args));



}


attributes.prototype.listen = async function listen({
    value,
    type,
    property,
    camelProperty,
    elementId,
    elementSelector
}) {
    // let sync;
    // switch (type) {
    //     case 'style':
    //         sync = property
    //         break;
    //     default:
    //         sync = camelProperty;

    // }
    let input = this.initDocument.querySelector(
        `[data-attributes=${type}][data-attributes_sync=${property}]:not(${this.exclude})`
    );
    
    let element = await this.complexSelector(elementSelector,
                (canvasDoc, selector) => canvasDoc.querySelector(selector));
    
    this.perInput(input, (inputMeta) =>
        this.updateElement({ ...inputMeta, input, element, newValue: value, isColl: false }))


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

    this.callback({ ...rest, element });

    CoCreate.message.send({
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
    this.initDocument.querySelectorAll(`[data-attributes][data-attributes_sync]:not(${this.exclude})`).forEach(async(input) => {
        this.perInput(input, (inputMeta, element) =>
            this.updateInput({ ...inputMeta, input, element, isColl: true }))
    });
}
attributes.prototype.observerElements = function observerElements(initWindow) {
    initWindow.CoCreate.observer.init({
        observe: ["attributes", "characterData"],
        callback: (mutation) => {
            let element = mutation.target;
            if (!element) return;
            this.getInputFromElement(mutation.target).forEach(input => {
                let inputMeta = this.validateInput(input);
                this.updateInput({ ...inputMeta, input, element });
            })

        },
    });
}

//convention based (all elements should use data-elememet_id and it's faster)
// made it also support "id"
attributes.prototype.getInputFromElement = function getInputFromElement(element) {


    let elId = element.getAttribute('data-element_id') || element.id && `"#${element.id }"`;
    if (elId)
        return this.initDocument.querySelectorAll(`[data-attributes_target=${elId}]`)
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


    try {
        let inputMeta, element;
        inputMeta = this.validateInput(input);
        element = inputMeta && await this.getElementFromInput(input);
        if (!element) throw new Error('attribute: Element can not be found')
        callback(inputMeta, element)
    }
    catch (error) {
        console.error(error)
    }

}




attributes.prototype.validateInput = function validateInput(input) {
    let type = input.getAttribute("data-attributes");
    if (!type) {
        // console.warn("cc-style: input doesn't have data-attributes")
        return;
    }
    let property = input.getAttribute("data-attributes_sync");
    if (!property) {
        // console.warn("cc-style: input doesn't have data-attributes")
        return;
    }

    type = type.toLowerCase();
    let camelProperty = toCamelCase(property);
    property = property.toLowerCase();


    return {
        type,
        property,
        camelProperty,

    };
}


attributes.prototype.updateElementByValue = function updateElementByValue({ type, property, camelProperty, input, element, newValue, inputValue }) {
    let computedStyles, value, removeValue, hasUpdated;
    switch (type) {
        case 'property':
            if (element[camelProperty] != inputValue) {
                element[camelProperty] = inputValue;
                return true;
            }
            else return false;

        case 'attribute':
            switch (property) {
                case 'style':
                    if (typeof inputValue == 'string') {
                        let style = parseCssRules(inputValue);
                        Object.assign(element.style, )
                        return Object.keys(style).length;

                    }
                    else {
                        value = {}, removeValue = {};
                        inputValue.forEach(inputSValue => {
                            let parse = parseCssRules(inputSValue.value);

                            if (inputSValue.checked)
                                Object.assign(value, parse);
                            else
                                Object.assign(removeValue, parse);
                        })
                        let elStyle = parseCssRules(element.getAttribute('style'));

                        for (let [key, value] of Object.entries(elStyle)) {
                            if (removeValue.hasOwnProperty(key))
                                delete elStyle[key]

                        }
                        Object.assign(elStyle, value);

                        let strStyle = "";
                        for (let [key, value] of Object.entries(elStyle))
                            strStyle += `${key}: ${value};`
                        element.setAttribute('style', strStyle)

                        //todo: better way to save elStyle when getting and here to compare
                        return Object.keys(elStyle).length;

                    }



                case 'class':
                    if (typeof inputValue == 'string') {
                        let classNames = inputValue.split(' ');
                        classNames.forEach(className => {
                            className && element.classList.add(className);
                        });
                        return classNames.length;
                    }
                    else {
                        value = [], removeValue = [];
                        inputValue.forEach(inputSValue => {
                            let parse = inputSValue.value.split(' ');

                            if (inputSValue.checked)
                                value = value.concat(parse)
                            else
                                removeValue = removeValue.concat(parse)

                        })
                        removeValue.forEach(className => element.classList.remove(className))
                        value.forEach(className => element.classList.add(className))

                        //todo: fix
                        return true;
                    }




                default:
                    if (typeof inputValue == 'string') {

                        return setAttributeIfDif.call(element, property, inputValue)
                    }
                    else {
                        for (let inputSValue of inputValue) {
                            if (inputSValue.checked) {
                                // unconventional change
                                if (property === 'data-attributes_unit' && ['auto', 'inherit', 'initial'].includes(inputSValue.value)) {
                                    element.value = inputSValue.value;
                                    removeAllSelectedOptions.call(input)
                                }
                                else
                                    // unconventional change
                                    return setAttributeIfDif.call(element, property, inputSValue.value)

                            }

                        }


                    }

                    break;
            }

            break;
        case 'classstyle':
            inputValue = inputValue || newValue || '';
            value = inputValue ? inputValue + (input.getAttribute('data-attributes_unit') || '') : '';
            computedStyles = this.getRealStaticCompStyle(element);
            return setStyleClassIfDif(element, {
                property,
                camelProperty,
                value,
                computedStyles
            })


        case 'style':
            inputValue = inputValue || newValue || '';
            value = inputValue ? inputValue + (input.getAttribute('data-attributes_unit') || '') : '';
            computedStyles = this.getRealStaticCompStyle(element);
            return setStyleIfDif.call(element, { property, camelProperty, value, computedStyles })

    }


}

attributes.prototype.updateElement = function updateElement({ input, element, newValue, isColl, ...rest }) {
    let inputValue;
    if (newValue)
        inputValue = parseUnit(newValue)[0];
    else
        inputValue = this.getInputValue(input);

    let hasUpdated = this.updateElementByValue({ ...rest, input, element, inputValue })

    cache.reset(element)

    hasUpdated &&
        isColl &&
        this.collaborate({
            value: inputValue + (input.getAttribute('data-attributes_unit') || ''),
            input,
            element,
            ...rest
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
        case 'property':
            value = element[camelProperty];
            break;
        case 'attribute':
            value = element.getAttribute(property);
            // setAttributeIfDif.call(input, property, value || '')
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
        default:
            break;
    }

    this.setInputValue(input, value);

}

attributes.prototype.setInputValue = function setInputValue(input, value) {
    let inputType = input.tagName.toLowerCase() || input.classList.has('.pickr') && 'pickr';

    switch (inputType) {
        case 'input':
            switch (input.type) {
                case 'checkbox':
                case 'radio':
                    input.checked = value == input.value ? true : false;
                    break;
                default:
                    input.value = value;
            }
            break;
        case "textarea":
            input.value = value;
            break;
        case 'select':
            let options = Array.from(input.options)
            options.forEach(option => {
                if (value == option.value)
                    input.selectedIndex = options.indexOf(option);
            })
            break;
        case 'cocreate-select':
            renderOptions(input, value)
            break;
        case 'pickr':
            // todo: how to perform validation
            let pickrIns = CoCreate.pickr.refs.get(input);
            CoCreate.pickr.disabledEvent = true;
            pickrIns.setColor(style);
            CoCreate.pickr.disabledEvent = false;

        default:
            console.warn('CoCreateStyle: unidentified input: ', inputType, 'input ', input)
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
    let inputType = input.tagName.toLowerCase() || input.classList.has('.pickr') && 'pickr';

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
                inputs: input.querySelectorAll(":scope > [selected]"),
                forceState: true
            });

        case 'pickr':
            // todo: how to perform validation
            // if (!CoCreate.pickr.refs.has(input)) return; 
            let pickrIns = CoCreate.pickr.refs.get(input);
            return pickrIns.getColor().toHEXA().toString();



        default:
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


attributes.prototype.complexSelector = async function complexSelector(comSelector, callback) {
    let [canvasSelector, selector] = comSelector.split(';');
    let canvas = document.querySelector(canvasSelector);
    if (!canvas) {
        console.warn('complex selector canvas now found for', comSelector)
        return
    }
    if (canvas.contentDocument.readyState === 'loading') {

        let prmise = new Promise((resolve, reject) => {
            canvas.contentWindow.addEventListener('load', (e) => resolve())
        });
        await prmise;
    }
    this.observerElements(canvas.contentWindow)
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
//         //todo: group is static 
//         inputs.push(inp)
//         list.push(validateInput(inp))
//     })
//     groupEl.set(input, inputs);
//     return [list, element];
// }



// window.addEventListener('load', () => {
//     let attribute = new attributes({ document, exclude: '#ghostEffect,.vdom-item ' })
//     attribute.init()
// })

export default {
    init: (params) => {
        let s = new attributes(params)
        s.init();
        return s;
    }
};
