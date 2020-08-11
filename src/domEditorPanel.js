  let canvas = document.querySelector('#canvas').contentDocument;


  let input1 = document.querySelector('#input1');

  CoCreateSocket.listen('inputChange', function(data) {
    console.log('raw object recieved: ', data.target, data.value[1], window.location.pathname)
    // resolving the element_id to real element in the clinet
    if (input1.getAttribute('data-target') == data.target)
      input1.setAttribute('value', data.value[1])
    data.target = canvas.querySelector(`[data-element_id=${data.target}]`);

    // passing it to domEditor
    domEditor(data);
  })



  canvas.addEventListener('click', (e) => {



    input1.setAttribute('data-attribute', 'data-coc-editable')
    input1.setAttribute('data-target', e.target.getAttribute('data-element_id'))
    input1.setAttribute('value', e.target.getAttribute('data-coc-editable'))

  })

  input1.addEventListener('input', (e) => {

    let elId = e.target.getAttribute('data-target');
    let attribute = e.target.getAttribute('data-attribute');
    let element = canvas.querySelector('[data-element_id=' + elId + ']')

    CoCreate.sendMessage({
      broadcast_sender: true,
      rooms: '',
      emit: {
        message: 'inputChange',
        data: {
          target: elId,
          method: 'setAttribute',
          value: [attribute, e.target.value]
        }
      }
    })



    // element.setAttribute(attribute, e.target.value)
  })


  // let map = {

  //   '*': {'name': {whenShow: 'always show'}, id: {whenShow: 'when available'}},
  //   'div': {'class': {whenshow: 'always show'}}

  // }
  