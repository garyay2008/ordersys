const mongoose = require('mongoose')
const User = mongoose.model('users')
const Staff = mongoose.model('staff')
const keys = require('./config.js').secretKey
const JwtStrategy = require('passport-jwt').Strategy,
  ExtractJwt = require('passport-jwt').ExtractJwt
const opts = {}
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken()
opts.secretOrKey = keys

module.exports = passport => {
  passport.use(
    new JwtStrategy(opts, (jwt_payload, done) => {
      // 員工（POS）token
      if (jwt_payload.kind === 'staff') {
        return Staff.findById(jwt_payload.id)
          .then(staff => {
            if (staff) return done(null, staff)
            return done(null, false)
          })
          .catch(err => done(err, false))
      }
      // 管理員 token
      return User.findById(jwt_payload.id)
        .then(user => {
          if (user) return done(null, user)
          return done(null, false)
        })
        .catch(err => done(err, false))
    })
  )
}
