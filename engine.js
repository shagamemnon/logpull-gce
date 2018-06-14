'use strict'

const cron = require('node-cron')
const eos = require('end-of-stream')
const fs = require('fs')
const moment = require('moment')
const request = require('request')
const Storage = require('@google-cloud/storage')

const storage = new Storage()

// Methods for polling Cloudflare Logpull API and posting to SCC API
class PollingEngine {
  constructor (setup, zones, schema) {
    this.setup = setup
    this.zones = zones
    this.bucketName = setup.bucket
    this.schema = schema.join()
    this.start = moment().startOf('minute').subtract(6, 'minutes').toISOString()
    this.end = moment().startOf('minute').subtract(5, 'minutes').toISOString()
  }

  pollEvents () {
    cron.schedule(`* * * * *`, () => {
      console.log(`Polled ELS on:`)
      this.zones.map(z => {
        console.log(z)
        const endpoint = `https://api.cloudflare.com/client/v4/zones/${z}/logs/received?start=${this.start}&end=${this.end}&fields=${this.schema}`
        console.log(endpoint)
        const stream = fs.createWriteStream(`gs://${this.bucketName}/tmp/${z}-${Date.now()}.json`)
        fs.writeFile(`gs://${this.bucketName}/tmp/${z}-${Date.now()}.json`)
        request
          .get({
            url: endpoint,
            headers: this.setup.cf.options
          })
          .on('error', err => {
            console.log(err)
          })
          .pipe(stream)

        eos(stream, err => {
          if (err) return console.log('stream had an error or closed early')
          this.uploadToGoogle(`./tmp/${z}.json`)
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
