var WILDCARD = '*'

var noop = function () {}

var StateMachine = function (state, transitions) {
  this.state = state
  this.transitions = transitions
  this.pending = null
  this._events = Object.create(null)
}

StateMachine.prototype.onEnter = function (name, cb) {
  if (cb) this._addListener('onEnter:' + name, cb)
  else this._addListener('onEnter', name)
}

StateMachine.prototype.onLeave = function (name, cb) {
  if (cb) this._addListener('onLeave:' + name, cb)
  else this._addListener('onLeave', name)
}

StateMachine.prototype.onPending = function (cb) {
  this._addListener('onPending', cb)
}

StateMachine.prototype.onError = function (cb) {
  this._addListener('onError', cb)
}

StateMachine.prototype.trigger = function (name) {
  var self = this
  var transitions = this.transitions[name]
  if (this.pending) return this._triggerListeners('onPending', [this.pending])
  if (!transitions) return this._triggerErrorListeners(new Error(`unknown transition ${name}`))

  var onerror = function (err) {
    self.pending = null
    self._triggerErrorListeners(err)
  }

  var target = transitions.find(function (transition) {
    if (Array.isArray(transition.from)) return transition.from.indexOf(self.state) !== -1
    else return transition.from === self.state
  })

  if (!target) target = transitions.find(transition => transition.from === WILDCARD)
  if (!target) return this._triggerErrorListeners(new Error(`cannot apply transition ${name} from state ${this.state}`))

  var args = Array.prototype.slice.call(arguments, 1)

  this.pending = { from: this.state, to: target.to }
  this._triggerHookListeners('onLeave', this.state, args, function (err) {
    if (err) return onerror(err)

    self._triggerHookListeners('onEnter', target.to, args, function (err) {
      if (err) return onerror(err)
      self.state = target.to
      self.pending = null
    })
  })
}

StateMachine.prototype._addListener = function (name, cb) {
  var events = this._events[name]
  if (!events) events = this._events[name] = []
  events.push(cb)
}

StateMachine.prototype._triggerListeners = function (name, args, cb) {
  if (!cb) cb = noop

  var events = this._events[name]
  if (!events) return cb()
  var promises = []

  events.forEach(function (fn) {
    var result = fn.apply(null, args)
    if (result instanceof Promise) promises.push(result)
  })

  if (!promises.length) return cb()
  else {
    Promise.all(promises)
      .then(() => cb())
      .catch(cb)
  }
}

StateMachine.prototype._triggerHookListeners = function (hook, name, args, cb) {
  var self = this
  this._triggerListeners(hook + ':' + name, args, function (err) {
    if (err) return cb(err)
    args = [self.pending].concat(args)
    self._triggerListeners(hook, args, cb)
  })
}

StateMachine.prototype._triggerErrorListeners = function (err) {
  this._triggerListeners('onError', [err])
}

module.exports = StateMachine
