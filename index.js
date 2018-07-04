'use strict'

const moment = require('moment')
const setup = require('./setup')
const express = require('express')
require('express-async-errors')
const app = express()
const async = require('neo-async')
const request = require('request')
const storage = require('@google-cloud/storage')()

class PollingEngine {
  constructor () {
    this.bucketName = storage.bucket(setup.bucket)
    this.setup = setup
    this.zones = this.setup.zones
    this.schema = this.setup.schema
    this.start = moment().startOf('minute').subtract(setup.logpullStart, 'minutes').toISOString()
    this.end = moment().startOf('minute').subtract(setup.logpullEnd, 'minutes').toISOString()
  }

  pollEvents () {
    console.log(`Polled ELS on:`)
    this.zones.forEach(z => {
      this.file = this.bucketName.file(`${this.start}-${z}.json`)
      const endpoint = `https://api.cloudflare.com/client/v4/zones/${z}/logs/received?start=${this.start}&end=${this.end}&fields=${this.schema}`
      const stream = this.file.createWriteStream()
      request
        .get({
          url: endpoint,
          headers: this.setup.headers
        })
        .on('error', err => {
          console.log(err)
        })
        .pipe(stream)
        .on('error', function (err) {
          return console.log('stream had an error or closed early ', err)
        })
        .on('finish', function () {
          console.log(`Log upload complete for zone ${z}`)
        })
    })
  }

  reset () {
    try {
      delete this.zones
      this.zones = []
      return this
    } catch (e) {
      return this.start()
    }
  }
}

const engine = new PollingEngine()

function handleGET (req, res) {
  engine.pollEvents()
  res.status(200).send(`${moment()}`)
}

function handlePUT (req, res) {
  res.status(403).send('Forbidden!')
}

/**
 * Responds to a GET request with "Hello World!". Forbids a PUT request.
 *
 * @example
 * gcloud alpha functions call helloHttp
 *
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */
exports.pollELS = (req, res) => {
  switch (req.method) {
    case 'GET':
      handleGET(req, res)
      break;
    case 'PUT':
      handlePUT(req, res)
      break;
    default:
      res.status(500).send({ error: 'Something blew up!' })
      break;
  }
}

// exports.jsonLoad = function jsonLoad(event) {

// }

// exports.pollELS
app.listen(process.env.PORT || 3000)
console.log('\nϟϟϟ Cloudflare server initialized ϟϟϟ\n')
