'use strict'

const cron = require('node-cron')
const moment = require('moment')
const server = require('http').Server()
const setup = require('./setup')
const Engine = require('./pollELS')

// Firewall events monitoring engine
const monitor = (options) => {
  let engine = new Engine(options)
  engine.start().then(eng => {
    console.log(`\nStarted monitoring Firewall activity on ${eng.zones.length} zones.`)
    console.log(`\n${moment()}\n---------------------------------`)
    eng.pollEvents()
    cron.schedule(`* 6 * * *`, () => {
      console.log(`\nReset assets at ${moment()}\n---------------------------------`)
      return eng.reset()
    })
  }).catch(e => {
    console.log(e, `: Reinitializing`)
    initialize()
  })
}

// Verify Cloudflare organization ID and start monitor
const initialize = () => {
  setup.start().then(() => {
    console.log(`Setup initalized`)
    return monitor(setup)
  }).catch(e => {
    console.log(e, `: Reinitializing`)
    initialize()
  })
}

initialize()

// Server
server.listen(process.env.PORT || 3000)
console.log('\nϟϟϟ Cloudflare server initialized ϟϟϟ\n')
