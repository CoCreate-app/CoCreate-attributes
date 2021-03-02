/*global CoCreate*/

export function parseClassRules(str)
{
    return str.split(' ').filter(cln => cln);
    
}

export function getCoCreateStyle(classList) {
    let styles = {};
    classList.forEach((classname) => {
        let [name, value] = classname.split(":");
        styles[toCamelCase(name)] = value;
    });

    return styles;
}




export function setStyleClassIfDif(element, { property, camelProperty,value, computedStyles }) {
    let classList = element.classList;
    let styleList = new Map();
    classList.forEach((classname) => {
        let [name, value] = classname.split(":");
        value && styleList.set(name, value);
    });

    let elValue = styleList.get(property);

    if (value) {
        if (elValue) {
            if (elValue != value)
                return classList.replace(`${property}:${elValue}`, `${property}:${value}`);
        }
        else if (computedStyles[camelProperty] != value)
            return classList.add(`${property}:${value}`);
    }
    else {
        return classList.remove(`${property}:${elValue}`);
    }

    return false
}


export function setAttributeIfDif(property, value) {
    if (this.getAttribute(property) !== value) {
        if (value)
            this.setAttribute(property, value);
        else
            this.removeAttribute(property)
        return true;
    }
    return false;
}

export function setStyleIfDif({ property, camelProperty, value, computedStyles }) {
    if (computedStyles[camelProperty] && computedStyles[camelProperty] !== value) {
        this.style[property] = value;
        return true;
    }
    else return false;
}


// CoCreate Select helper
// export function getAllSelectedOptions() {
//     let options = this.querySelectorAll(":scope > [selected]");
//     return Array.from(options).map((o) => o.getAttribute("value"));
// };

export function removeAllSelectedOptions() {
    let options = this.querySelectorAll(":scope > [selected]");
    return Array.from(options).forEach((o) => o.remove());
};

// export function getAllOptions() {
//     let options = this.querySelectorAll(":scope > ul > [value]");
//     return Array.from(options).map((o) => o.getAttribute("value"));
// };

export function renderOptions(input, arrValue) {
    if (arrValue && arrValue.length)
        CoCreate.select.renderValue(input, arrValue)
    else
        removeAllSelectedOptions.call(input)
}
// CoCreate Select helper end  
export function parseCssRules(str) {
    let styleObject = {};
    if (str.split)
        str.split(";").forEach((rule) => {
            let ruleSplit = rule.split(":");
            let key = ruleSplit.shift().trim();
            let value = ruleSplit.join().trim();
            if (key) styleObject[key] = value;
        });

    return styleObject;
}












export function rgba2hex(orig) {
    let a, isPercent,
        rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i),
        alpha = (rgb && rgb[4] || "").trim(),
        hex = rgb ?
        (rgb[1] | 1 << 8).toString(16).slice(1) +
        (rgb[2] | 1 << 8).toString(16).slice(1) +
        (rgb[3] | 1 << 8).toString(16).slice(1) : orig;

    if (alpha !== "") {
        a = alpha;
    }
    else {
        a = 1;
    }
    // multiply before convert to HEX
    a = ((a * 255) | 1 << 8).toString(16).slice(1)
    hex = hex + a;

    return hex;
}



export function parseUnit(style) {
    let value = parseFloat(style);
    if (isNaN(value))
        return [style, '']
    else {
        let valueLength = (value + "").length;
        return [value, style.substr(valueLength)];

    }
}


export function toCamelCase(str) {
    let index = 0;
    do {
        index = str.indexOf("-", index);
        if (index !== -1) {
            let t = str.substring(0, index);
            t += String.fromCharCode(str.charCodeAt(index + 1) - 32);
            t += str.substr(index + 2);
            str = t;
        }
        else break;
    } while (true);
    return str;
}

// export function setCCStyle({ property, camelProperty, value, computedStyles }) {
//     let hasChanged = false;
//     if (computedStyles[camelProperty]  && computedStyles[camelProperty] !== value) {
//         for (let classname of this.classList) {
//             let [name, styleValue] = classname.split(":");
//             if (name === property && styleValue) {
//                 if (value)
//                     this.classList.replace(classname, property + ":" + value);
//                 else
//                     this.classList.remove(classname)
//                 hasChanged = true;
//                 break;
//             }
//         }
//         if (!hasChanged)
//             this.classList.add(property + ":" + value);
//         return true;
//     } else
//         return false;
// }







export function elStore() {
    this.cache = new Map();
    this.spread = function set(key, object) {
        this.cache.set(key, { ...this.cache.get(key), ...object })
    }
    this.set = function set(key, property, value) {
        this.cache.set(key, { ...this.cache.get(key), [property]: value })
    }
    this.get = function get(key, property) {
        let value = this.cache.get(key)
        return value ? value[property] : undefined;
    }
    this.reset = function reset(key) {
        this.cache.delete(key)
    }
}
