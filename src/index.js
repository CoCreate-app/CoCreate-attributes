import attributes from './attributes.js';

window.addEventListener('load', () => {
    let attribute = new attributes({ document });
    attribute.init();
})