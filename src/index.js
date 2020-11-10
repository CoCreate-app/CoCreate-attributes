/*global MutationObserver*/

/**
 * refactor:
 * refactor mutation observer to a component
 * refactor cc_select_utility, allFrame, parseCssRules, parseClassList to a global/general workspace
 */


const cocreateUtility = {
  getAllSelectedOptions: function () {
    let options = this.querySelectorAll(":scope > [selected]");
    return Array.from(options).map((o) => o.getAttribute("value"));
  },
  getAllOptions: function () {
    let options = this.querySelectorAll(":scope > ul > [value]");
    return Array.from(options).map((o) => o.getAttribute("value"));
  },
  // select option or arrays of options
  selectOption: function (optionName) {
    // if(this.getAllOptions().includes(optionName))
    CoCreateSelect.__selectValue(optionName, this);
  },

  // unselect option or arrays of options, and remove all if not param
  unselectOption: function (optionName) {
    let options = this.querySelectorAll(":scope > [selected]");
    Array.from(options).forEach((option) => {
      if (optionName == option.getAttribute("value")) option.remove();
    });
  },
};


window.addEventListener("load", () => {
  //store all frames
  let canvas;
  try {
    let canvasIframe = document.querySelector("#canvas");
    let canvasWindow = canvasIframe.contentWindow;
    canvas = canvasIframe.contentDocument || canvasWindow.document;
  } catch (error) {
    console.log(error);
  }
  try {
    console.log("attribute loaded");
    let allFrames = [{ document, window }];
    for (let frame of document.querySelectorAll("iframe")) {
      let frameDocument = frame.contentDocument || frame.contentWindow.document;
      let frameWindow = frame.contentWindow;
      allFrames.push({ document: frameDocument, window: frameWindow });
    }

    // function to go through all frames
    function allFrame(callback) {
      let result = new Set();
      for (let frame of allFrames) {
        let callbackResult = callback(frame.document, frame.window);
        if (
          callbackResult &&
          typeof callbackResult[Symbol.iterator] === "function"
        )
          callbackResult.forEach((el) => result.add(el));
        else if (callbackResult) result.add(callbackResult);
      }

      return Array.from(result);
    }

    // get all inputs in all frames with data-attribute
    let inputs = allFrame((document) =>
      document.querySelectorAll("[data-attribute_sync]")
    );

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

    function parseClassList(str) {
      if (str.split) return str.split(" ");
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

    function __addToElement(input, element, type, read) {
      let values;
      if (typeof type === "object") values = type;
      else values = [input.getAttribute(type) || input[type]];

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
            element.setAttribute(read, value);
        }
      });
    }

    function __removeToElement(input, element, type, read) {
      let values;
      if (typeof type === "object") values = type;
      else values = [input.getAttribute(type) || input[type]];

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

    inputs.forEach((input) => {
      //add cc_select_utility
      if (input.tagName === "COCREATE-SELECT") {
        for (let [k, v] of Object.entries(cocreateUtility)) {
          input[k] = v;
        }
      }

      input.addEventListener("input", (e) => {
        let input = e.target;

        const elSelectorId = input.getAttribute("data-attribute_target");
        if (!elSelectorId) return;
        let elements = allFrame((document) =>
          document.querySelector(elSelectorId)
        );

        let read = e.target.getAttribute("data-attribute_sync");

        elements.forEach((element) => {
          fromInput(input, (type, metadata) => {
            // if (type == "COCREATE-SELECT") {
            //   let possibleLi = input.querySelectorAll(":scope > ul > li");
            //   possibleLi.forEach((li) => {
            //     __removeToElement(li, element, "value", read);
            //   });
            //   let selectedLis = input.querySelectorAll(
            //     ":scope > li[selected][value]"
            //   );
            //   selectedLis.forEach((li) => {
            //     __addToElement(li, element, "value", read);
            //   });
            //   return;
            // }

            if (metadata && metadata.type === "checkbox") {
              let status = input[metadata.read];
              if (status) __addToElement(input, element, type, read);
              else __removeToElement(input, element, type, read);
            } else if (metadata && metadata.type === "radio") {
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
            } else if (metadata && metadata.type === "select") {
              let selectedOptions = getSelectOptions(input, true);
              let unSelectedOptions = getSelectOptions(input, false);

              __addToElement(input, element, selectedOptions, read);
              __removeToElement(input, element, unSelectedOptions, read);
            } else if (metadata && metadata.type === "cocreate-select") {
              let selectedOptions = input.getAllSelectedOptions();
              let unSelectedOptions = input
                .getAllOptions()
                .filter((o) => !selectedOptions.includes(o));

              __addToElement(input, element, selectedOptions, read);
              __removeToElement(input, element, unSelectedOptions, read);
            } else {
              __removeToElement(input, element, "lastValue", read);
              __addToElement(input, element, type, read);
            }
          });
        });
      });
    });

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
      let options = input.getAllOptions();
      for (let i = 0, len = options.length; i < len; i++) {
        switch (read) {
          case "style":
            let parsed = parseCssRules(options[i]);

            if (isObjectEqual(parsed, element.style))
              input.selectOption(options[i]);
            else input.unselectOption(options[i]);

            break;
          case "class":
            if (element.classList.contains(options[i]))
              input.selectOption(options[i]);
            else input.unselectOption(options[i]);

            break;
          default:
            if (element.getAttribute(read) == options[i])
              input.selectOption(options[i]);
            else input.unselectOption(options[i]);
        }
      }
    }

    allFrame((frame) =>
      frame.querySelectorAll("[data-attribute_target]")
    ).forEach((input) => {
      let elementSel = input.getAttribute("data-attribute_target");
      let element = allFrame((frame) => frame.querySelector(elementSel))[0];

      let read = input.getAttribute("data-attribute_sync");
      if (element.getAttribute(read))
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
          } else if (input.tagName == "COCREATE-SELECT") {
            fromElementToCCSelect({ input, element, read });
          } else {
            input.lastValue = input.value;
            input.value = fromElementToText({ element, read });
          }
        });
    });

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
      if (element.getAttribute("data-attribute_sync")) return;
      let connectedInput = inputs.filter((input) => {
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
            } else if (input.tagName == "COCREATE-SELECT") {
              fromElementToCCSelect({ input, element, read });
            } else {
              let inputValue = fromElementToText({ element, read });
              if (input.value.trim() == inputValue) return;
              input.lastValue = input.value;
              input.value = inputValue;
            }
          });
      });
    }

    // observe attribute mutation to update
    const mutationCallback = function (mutationsList, observer) {
      for (let mutation of mutationsList) {
        triggerElementMutation(mutation);
      }
    };

    const observer = new MutationObserver(mutationCallback);
    const config = {
      attributes: true,
      childList: false,
      subtree: true,
      characterData: true,
    };
    // allFrame((frame) => observer.observe(frame, config));
    observer.observe(document.body, config);

    function initInput(input) {
      const elSelectorId = input.getAttribute("data-attribute_target");
      if (!elSelectorId) return;

      let element;
      if (canvas) element = canvas.querySelector(elSelectorId);
      else element = allFrame((frame) => frame.querySelector(elSelectorId));

      let read = input.getAttribute("data-attribute_sync");
      fromInput(input, (type, metadata) => {
        if (metadata && metadata.class === "toggle")
          input.checked = fromElementToBoolean({
            input,
            element,
            inputValue: input.getAttribute("value"),
            read,
          });
        else input.value = fromElementToText({ element, read });
      });
    }

    inputs.forEach((input) => {
      initInput(input);
    });

    const mutationCallbackInput = function (mutationsList, observer) {
      for (let mutation of mutationsList) {
        if (mutation.target.tagName === "INPUT") initInput(mutation.target);
      }
    };

    const observer2 = new MutationObserver(mutationCallbackInput);

    allFrame((frame) =>
      observer2.observe(frame, {
        attributes: true,
        subtree: true,
        attributeFilter: ["data-attribute_target"],
      })
    );
  } catch (error) {
    console.log(error);
  }
});

// used to listen for click to update input
// allFrame((document) =>
//   document.addEventListener("click", (e) => {

//     inputs.forEach((input) => {
//       if (e.target === input) return;
//       let element = e.target;
//       let elId = element.getAttribute("data-element_id");
//       let read = input.getAttribute("data-attribute_sync");

//       if (!elId) return;

//       // input.setAttribute("data-attribute_target", `[data-element_id="${elId}"]`);
//       // element.setAttribute(read, input[to]);
//       // fromInput(input, (type) => input[type] = element.getAttribute(read))
//     });
//   })
// );
