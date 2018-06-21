'use strict'

require('dotenv').config()
const cron = require('node-cron')
const moment = require('moment')
const setup = require('./setup')
const PollingEngine = require('./engine')
const express = require('express')
require('express-async-errors')
const exp = express()
const { getSchema, jsonLoad } = require('./GCS-To-Big-Query/index')

// Firewall events monitoring engine
const monitor = (setup, zones, schema) => {
  let engine = new PollingEngine(setup, zones, schema)
  console.log(`\nStarted monitoring Firewall activity on ${engine.zones.length} zones.`)
  console.log(`\n${moment()}\n---------------------------------`)
  engine.pollEvents()
  cron.schedule(`* 6 * * *`, () => {
    console.log(`\nReset assets at ${moment()}\n---------------------------------`)
    return engine.reset()
  })
}

// Verify Cloudflare organization ID and start monitor
async function initialize () {
  let schema = []
  let zones = []
  Promise.resolve(getSchema()).then(sch => {
    sch.map(obj => { schema.push(obj.name) })
  }).then(() => {
    setup.cf.apiCall('zones').then(json => {
      for (let i = 0; i < json.result.length; i++) {
        zones.push(json.result[i].id)
        if (i >= json.result.length - 1) {
          return monitor(setup, zones, schema)
        }
      }
    })
  })
}

initialize()

exports.pollELS = async (req, res) => {
  const poll = await initialize()
  return res.send(poll).end()
}

exports.jsonLoad = jsonLoad

// exports.pollELS
exp.listen(process.env.PORT || 3000)
console.log('\nϟϟϟ Cloudflare server initialized ϟϟϟ\n')
