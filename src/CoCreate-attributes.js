/**
 * refactor:
 * refactor mutation observer to a component
 * refactor cc_select_utility, allFrame, parseCssRules, parseClassList to a global/general workspace
 */


  //store all frames

  let filters = [];
  let allFrames = new Map();
  let tools = {};


  // first time load
  window.addEventListener("load", () => {
    init({ windowObject: window, docObject: document });
    window.CoCreateObserver.add({
      observe: ["attributes", "characterData"],
      task: (mutation) => triggerElementMutation(mutation),
    });

    window.CoCreateObserver.add({
      name: "ccAttribute",
      observe: ["attributes"],
      attributes: ["data-attribute_target"],
      task: (mutation) => updateInput(mutation.target),
    });
    allFrame((frame) =>
      frame.querySelectorAll("[data-attribute_target]")
    ).forEach((input) => updateInput(input));
  });

  function updateInput(input) {
    const elSelectorId = input.getAttribute("data-attribute_target");
    if (!elSelectorId) return;

    let element = allFrame((frame) => frame.querySelector(elSelectorId))[0];

    let read = input.getAttribute("data-attribute_sync");
    if (element && element.getAttribute(read))
      fromInput(input, (type, metadata) => {
        if (metadata && metadata.class === "toggle")
          input.checked = fromElementToBoolean({
            input,
            element,
            inputValue: input.getAttribute("value"),
            read,
          });
        else if (input.tagName == "SELECT") {
          fromElementToSelect({ input, element, read });
        }
        else if (input.tagName == "COCREATE-SELECT") {
          fromElementToCCSelect({ input, element, read });
        }
        else {
          input.lastValue = input.value;
          input.value = fromElementToText({ element, read });
          // todo: up or bottom is correct which one?
          //input.value = fromElementToText({ element, read });
        }
      });
  }

  function parseCssRules(str) {
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
  
  function parseCssRulesAsArray(str) {
    if (str.split)
      return str.split(";").slice(0,-1).map(st => st.trim())
    return [];
  }
  

  function allFrame(callback) {
    let result = new Set();
    for (let [frameObject, frame] of allFrames) {
      let callbackResult = callback(frame.document, frame.window);
      if (
        callbackResult &&
        typeof callbackResult[Symbol.iterator] === "function"
      )
        callbackResult.forEach((el) => result.add(el));
      else if (callbackResult) result.add(callbackResult);
    }

    return Array.from(result).filter(
      (el) => !filters.some((filter) => el.matches(filter))
    );
  }

  function init({ windowObject, docObject, isIframe, frame, onCollaboration = () => {} }) {
    let ref;
    tools.onCollaboration = onCollaboration;
    if (isIframe) {
      let frameWindow = frame.contentWindow;
      let frameDocument = frameWindow.document || frame.contentDocument;

      ref = {
        frame,
        window: frameWindow,
        document: frameDocument,
        isIframe: true,
      };
      allFrames.set(frame, ref);
    }
    else {
      ref = { window: windowObject, document: docObject, isIframe: false };
      allFrames.set("main", ref);
    }

    ref.window.addEventListener("load", () => {
      ref.window.CoCreateObserver.add({
        observe: ["attributes", "characterData"],
        task: (mutation) => triggerElementMutation(mutation),
      });

      ref.window.CoCreateObserver.add({
        name: "ccAttribute",
        observe: ["attributes"],
        attributes: ["data-attribute_target"],
        task: (mutation) => updateInput(mutation.target),
      });
    });

    ref.window.HTMLElement.prototype.getAllSelectedOptions = function getAllSelectedOptions() {
      let options = this.querySelectorAll(":scope > [selected]");
      return Array.from(options).map((o) => o.getAttribute("value"));
    };
    ref.window.HTMLElement.prototype.getAllOptions = function getAllOptions() {
      let options = this.querySelectorAll(":scope > ul > [value]");
      return Array.from(options).map((o) => o.getAttribute("value"));
    };
  

    ref.document.addEventListener("input", (e) => {
      let input = e.target;

      const elSelectorId = input.getAttribute("data-attribute_target");
      if (!elSelectorId) return;
      let elements = allFrame((document) =>
        document.querySelector(elSelectorId)
      );

      let read = e.target.getAttribute("data-attribute_sync");

      elements.forEach((element) => {
        fromInput(input, (type, metadata) => {
          if (metadata && metadata.type === "checkbox") {
            let status = input[metadata.read];
            if (status) __addToElement(input, element, type, read);
            else __removeToElement(input, element, type, read);
          }
          else if (metadata && metadata.type === "radio") {
            __addToElement(input, element, type, read);

            let inputs = allFrame((frame) =>
              frame.getElementsByName(input.name)
            );
            inputs = Array.from(inputs);
            let ourInputIndex = inputs.indexOf(input);
            if (ourInputIndex !== -1) delete inputs[ourInputIndex];

            inputs.forEach((input) => {
              if (input) __removeToElement(input, element, type, read);
            });
          }
          else if (metadata && metadata.type === "select") {
            let selectedOptions = getSelectOptions(input, true);
            let unSelectedOptions = getSelectOptions(input, false);

            __addToElement(input, element, selectedOptions, read);
            __removeToElement(input, element, unSelectedOptions, read);
          }
          else if (metadata && metadata.type === "cocreate-select") {
            let selectedOptions2 = input.getAllSelectedOptions();
            // let unSelectedOptions2 = input
            //   .getAllOptions()
            //   .filter((o) => !selectedOptions2.includes(o));

            
            __addToElement(input, element, selectedOptions2, read);
            // __removeToElement(input, element, unSelectedOptions2, read);
          }
          else {
            __removeToElement(input, element, "lastValue", read);
            __addToElement(input, element, type, read);
          }
        });
      });
    });
  }

  // if (input.tagName === "COCREATE-SELECT" && !input.selectOption) {
  //   for (let [k, v] of Object.entries(cocreateUtility)) {
  //     input[k] = v;
  //   }
  // }

  function addFilter(selector) {
    filters.push(selector);
  }

  // inputs.forEach((input) => {
  //   //add cc_select_utility
  //   if (input.tagName === "COCREATE-SELECT") {
  //     for (let [k, v] of Object.entries(cocreateUtility)) {
  //       input[k] = v;
  //     }
  //   }
  //   inputAddEventListener(input)
  // });

  function triggerElementMutation(mutation) {
    let element;
    let attributeName;

    switch (mutation.type) {
      case "attributes":
        attributeName = mutation.attributeName;
        element = mutation.target;
        break;
      case "characterData":
        attributeName = "innerText";
        element = mutation.target.parentElement;
        break;
    }
    if (!element ||  (element && element.getAttribute("data-attribute_sync"))) return;

    let connectedInput = allFrame((frame) =>
      frame.querySelectorAll("[data-attribute_target]")
    ).filter((input) => {
      if (input.getAttribute("data-attribute_sync") !== attributeName)
        return false;
      let query = input.getAttribute("data-attribute_target");
      let elements = allFrame((frame) => frame.querySelectorAll(query));
      return elements.includes(element);
    });

    connectedInput.forEach((input) => {
      let read = input.getAttribute("data-attribute_sync");
      if (read === attributeName)
        fromInput(input, (type, metadata) => {
          if (metadata && metadata.class === "toggle")
            input.checked = fromElementToBoolean({
              input,
              element,
              inputValue: input.getAttribute("value"),
              read,
            });
          else if (input.tagName == "SELECT") {
            fromElementToSelect({ input, element, read });
          }
          else if (input.tagName == "COCREATE-SELECT") {
            fromElementToCCSelect({ input, element, read });
          }
          else {
            let inputValue = fromElementToText({ element, read });
            if (input.value.trim() == inputValue) return;
            input.lastValue = input.value;
            input.value = inputValue;
          }
        });
    });
  }

  function parseClassList(str) {
    if (str.split) return str.split(" ").map(st => st.trim());
    return [];
  }

  function isSubset(obj1, obj2) {
    for (let [key, value] of Object.entries(obj2)) {
      if (obj1[key] !== value) return false;
    }
    return true;
  }

  function fromInput(input, callback) {
    switch (input.tagName.toLowerCase()) {
      case "input":
        switch (input.type.toLowerCase()) {
          case "text":
          case "color":
          case "date":
            callback("value");
            break;
          case "checkbox":
            callback("value", {
              class: "toggle",
              type: "checkbox",
              read: "checked",
            });
            break;
          case "radio":
            callback("value", {
              class: "toggle",
              type: "radio",
              read: "checked",
            });

            break;
          default:
            callback("value");
        }
        break;
      case "select":
        callback("value", {
          type: "select",
          class: input.multiple ? "multiselect" : "select",
        });
        break;
      case "textarea":
        callback("value");
        break;
      case "cocreate-select":
        callback("COCREATE-SELECT", {
          type: "cocreate-select",
          class: input.multiple ? "multiselect" : "select",
        });
        break;
      default:
        if (input.getAttribute("contenteditable") !== null)
          callback("innerText");
        else callback("value");
    }
  }

  function fromElementToBoolean({ input, element, inputValue, read }) {
    switch (read) {
      case "style":
        let parsedCss = parseCssRules(inputValue);
        let elementStyle = element.style;

        return isSubset(elementStyle, parsedCss);

        break;
      case "class":
        let classList = parseClassList(inputValue);
        let targetClassList = Array.from(element.classList);
        return classList.every((className) =>
          targetClassList.includes(className)
        );
        break;

      default:
        return element.getAttribute(read) ? true : false;
    }
  }

  function fromElementToText({ element, read }) {
    switch (read) {
      case "style":
        return element.getAttribute(read);
        break;
      case "class":
        return element.classList.toString();
        break;
      case "innerText":
        return element.innerText;
        break;

      default:
        return element.getAttribute(read);
    }
  }

  function __addToElement(input, element, type, read, values) {
    if (!values) {
      if (typeof type === "object") values = type;
      else values = [input.getAttribute(type) || input[type]];
      collaborate({ method: "add", values, element, type, read });
    }
    values.forEach((value) => {
      switch (read) {
        case "style":
          if (!value) return;
          let parsedCss = parseCssRules(value);
          Object.assign(element.style, parsedCss);

          break;
        case "class":
          // value
          //   .split(" ")
          //   .forEach((classname) => element.classList.remove(classname));
          if (!value) return;
          value
            .split(" ")
            .forEach(
              (classname) => classname && element.classList.add(classname)
            );

          break;
        case "innerText":
          element[read] = value;
          triggerElementMutation({
            type: "characterData",
            target: { parentElement: element },
          });

          break;
        default:
          if (value) element.setAttribute(read, value);
          else element.removeAttribute(read);
      }
    });
  }

  function __removeToElement(input, element, type, read, values) {
    if (!values) {
      if (typeof type === "object") values = type;
      else values = [input.getAttribute(type) || input[type]];
      collaborate({ method: "remove", values, element, type, read });
    }
    values.forEach((value) => {
      switch (read) {
        case "style":
          if (!value) return;
          let parsedCss = parseCssRules(value);
          Object.keys(parsedCss).forEach((key) => {
            if (parsedCss[key]) element.style[key] = "";
          });

          break;
        case "class":
          // value
          //   .split(" ")
          //   .forEach((classname) => element.classList.remove(classname));
          if (!value) return;
          value
            .split(" ")
            .forEach(
              (classname) => classname && element.classList.remove(classname)
            );

          break;
        default:
          // element.removeAttribute(read);
      }
    });
  }

  function getSelectOptions(select, state) {
    let options = Array.from(select.options);
    return options
      .filter((o) => (state === undefined ? true : o.selected == state))
      .map((o) => o.value);
  }

  function isObjectEqual(object1, object2) {
    for (let [key, value] of Object.entries(object1))
      if (object1[key] !== object2[key] || object1[key] === "") return false;

    return true;
  }

  function fromElementToSelect({ input, element, read }) {
    for (let i = 0, len = input.options.length; i < len; i++) {
      switch (read) {
        case "style":
          let parsed = parseCssRules(input.options[i].value);

          if (isObjectEqual(parsed, element.style))
            input.options[i].selected = true;
          else input.options[i].selected = false;
          // if(unStyle.some(style => isObjectEqual(parsed, style)))

          break;
        case "class":
          if (element.classList.contains(input.options[i].value))
            input.options[i].selected = true;
          else input.options[i].selected = false;

          break;
        default:
          if (element.getAttribute(read) == input.options[i].value)
            input.options[i].selected = true;
          else input.options[i].selected = false;
      }
    }
  }

  function fromElementToCCSelect({ input, element, read }) {
    let options, selOptions = [], selOptions2;

    switch (read) {
      case "style":
        // options = input.getAllOptions();

        // for (let i = 0, len = options.length; i < len; i++) {
        //   let parsed = parseCssRules(options[i]);

        //   if (isObjectEqual(parsed, element.style))
        //     selOptions.push( options[i] );
        // }
        // CoCreateSelect.renderValue(input, selOptions)
        
        
          selOptions2 = parseCssRulesAsArray(element.getAttribute('style'))
          CoCreateSelect.renderValue(input, selOptions2)
        break;
      case "class":
        // options = input.getAllOptions();
        // for (let i = 0, len = options.length; i < len; i++) {
        //   if (element.classList.contains(options[i]))
        //     selOptions.push( options[i] );
        // }
        // CoCreateSelect.renderValue(input, selOptions)
          selOptions2 = parseClassList(element.getAttribute('class'))
          CoCreateSelect.renderValue(input, selOptions2)
        
        break;
      default:
        if (element.getAttribute(read))
          CoCreateSelect.renderValue(input, element.getAttribute(read))
        // todo: might break
        // if (element.getAttribute(read) == options[i])
        //   input.selectOption(options[i]);
        // else input.unselectOption(options[i]);
    }

  }

  CoCreate.socket.listen("ccAttribute", function({
    method,
    values,
    element,
    type,
    read,
  }) {
    element = allFrame((frame) =>
      frame.querySelector("[data-element_id=" + element + "]")
    )[0];
    if (method === "add") {
      __addToElement(null, element, type, read, values);
    }
    else if (method === "remove") {
      __removeToElement(null, element, type, read, values);
    }
  });

  function collaborate(data) {
    tools.onCollaboration({
      value: Array.isArray(data.values) ? data.values.join(' ') : data.values,
      read: data.read,
      element: data.element,

    });

    CoCreate.message.send({
      broadcast_sender: false,
      rooms: "",
      emit: {
        message: "ccAttribute",
        data: {
          ...data,
          element: data.element.getAttribute("data-element_id"),
        },
      },
    });
  }

export default { init, addFilter };

