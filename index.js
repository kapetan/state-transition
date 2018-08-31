var WILDCARD = '*'

var noop = function () {}

var StateMachine = function (state, transitions, options) {
  if (!options) options = {}

  this.state = state
  this.transitions = transitions
  this.pending = null
  this._events = Object.create(null)

  var self = this

  if (options.initial) {
    process.nextTick(function () {
      self.pending = { to: state }
      self._triggerHookListeners('onEnter', state, [], function (err) {
        if (err) return self._triggerErrorListeners(err)
        self.pending = null
      })
    })
  }
}

StateMachine.prototype.onEnter = function (name, cb) {
  this._addHookListeners('onEnter', name, cb)
}

StateMachine.prototype.onLeave = function (name, cb) {
  this._addHookListeners('onLeave', name, cb)
}

StateMachine.prototype.onError = function (cb) {
  this._addListener('onError', cb)
}

StateMachine.prototype.trigger = function (name, cb) {
  var self = this
  var transitions = this.transitions[name]
  var onerror = function (err) {
    self.pending = null
    self._triggerErrorListeners(err)
    if (cb) cb(err)
  }

  if (this.pending) return onerror(new Error(`Transition to state ${this.pending.to} in progress`))
  if (!transitions) return onerror(new Error(`Unknown transition ${name}`))

  var target = transitions.find(function (transition) {
    if (Array.isArray(transition.from)) return transition.from.indexOf(self.state) !== -1
    else return transition.from === self.state
  })

  if (!target) target = transitions.find(transition => transition.from === WILDCARD)
  if (!target) return onerror(new Error(`Cannot apply transition ${name} from state ${this.state}`))

  var args = Array.prototype.slice.call(arguments, 1)

  var ontarget = function (to) {
    self.pending = { from: self.state, to: to }
    self._triggerHookListeners('onLeave', self.state, args, function (err) {
      if (err) return onerror(err)

      self._triggerHookListeners('onEnter', to, args, function (err) {
        if (err) return onerror(err)
        self.state = to
        self.pending = null
      })
    })
  }

  if (typeof target.to !== 'function') ontarget(target.to)
  else {
    var result = target.to.apply(this, [this.state].concat(args))

    if (result instanceof Promise) {
      result
        .then(ontarget)
        .catch(onerror)
    } else {
      ontarget(result)
    }
  }
}

StateMachine.prototype._addListener = function (name, cb) {
  var events = this._events[name]
  if (!events) events = this._events[name] = []
  events.push(cb)
}

StateMachine.prototype._addHookListeners = function (hook, name, cb) {
  if (cb) this._addListener(hook + ':' + name, cb)
  else this._addListener(hook, name)
}

StateMachine.prototype._triggerListeners = function (name, args, cb) {
  if (!cb) cb = noop

  var self = this
  var events = this._events[name]
  if (!events) return cb()
  var promises = []

  events.forEach(function (fn) {
    var result = fn.apply(self, args)
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
