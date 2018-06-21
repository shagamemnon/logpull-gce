'use strict'

require('dotenv').config()
const cron = require('node-cron')
const moment = require('moment')
const request = require('request')
const storage = require('@google-cloud/storage')()

// Methods for polling Cloudflare Logpull API and posting to SCC API
class PollingEngine {
  constructor (setup, zones, schema) {
    this.setup = setup
    this.zones = zones
    this.bucketName = storage.bucket(setup.bucket)
    this.schema = schema.join()
    this.start = moment().startOf('minute').subtract(setup.logpullStart, 'minutes').toISOString()
    this.end = moment().startOf('minute').subtract(setup.logpullEnd, 'minutes').toISOString()
  }

  pollEvents () {
    cron.schedule(`* * * * *`, () => {
      console.log(`Polled ELS on:`)
      this.zones.map(z => {
        this.file = this.bucketName.file(`${Date.now()}-z-log.json`)
        const endpoint = `https://api.cloudflare.com/client/v4/zones/${z}/logs/received?start=${this.start}&end=${this.end}&fields=${this.schema}`
        const stream = this.file.createWriteStream()
        request
          .get({
            url: endpoint,
            headers: this.setup.cf.options
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
    })
  }

  uploadToGoogle (filename) {
    return storage
      .bucket(this.bucketName)
      .upload(filename)
      .then(() => {
        console.log(`${filename} uploaded to ${this.bucketName}.`)
      })
      .catch(err => {
        console.error('ERROR:', err)
      })
  }

  reset () {
    try {
      delete this._zones
      this.zones = []
      return this
    } catch (e) {
      return this.start()
    }
  }
}

module.exports = PollingEngine
