'use strict'

const moment = require('moment')
const request = require('request')
const storage = require('@google-cloud/storage')()
const express = require('express')
const config = require('./config.json')
const credentials = require('./credentials.json')
require('express-async-errors')
const app = express()

class PollingEngine {
  constructor () {
    this.config = config
    this.bucketName = storage.bucket(this.config.BUCKET_NAME)
    this.fields = this.config.FIELDS.slice(0, -1)
    this.zones = this.config.ZONES
    this.headers = credentials
    this.start = moment().startOf('minute').subtract(config.LOGPULL_START_TIME, 'minutes').toISOString()
    this.end = moment().startOf('minute').subtract(config.LOGPULL_END_TIME, 'minutes').toISOString()
  }

  pollEvents () {
    console.log(`Polled ELS on:`)
    this.zones.forEach(z => {
      this.file = this.bucketName.file(`${this.start}-${z}.json`)
      const endpoint = `https://api.cloudflare.com/client/v4/zones/${z}/logs/received?start=${this.start}&end=${this.end}&fields=${this.fields}`
      const stream = this.file.createWriteStream()
      request
        .get({
          url: endpoint,
          headers: this.headers
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
      break
    case 'PUT':
      handlePUT(req, res)
      break
    default:
      res.status(500).send({ error: 'Something blew up!' })
      break
  }
}
