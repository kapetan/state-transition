# state-transition

Simple state machine library.

    npm install state-transition

# Usage

First argument to the constructor is the initial state followed by the state transitions.

```javascript
var StateMachine = require('state-transition')

var sm = new StateMachine('idle', {
  start: [
    { from: 'idle', to: 'analyzing' }
  ],
  stop: [
    { from: 'analyzing', to: 'advisory', condition: () => some_condition }
  ],
  cancel: [
    { from: ['analyzing', 'advisory'], to: 'idle' }
  ],
  advisory: [
    { from: '*', to: 'advisory' }
  ]
})

sm.onEnter('analyzing', function () {
  console.log('analyzing started')
})

sm.onLeave('analyzing', function () {
  console.log('analyzing finished')
})

sm.onError(function (err) {
  console.error('error', err)
})

sm.trigger('start')
```
