'use strict'

const cron = require('node-cron')
const eos = require('end-of-stream')
const fs = require('fs')
const moment = require('moment')
const mkdirp = require('mkdirp')
const request = require('request')
const Storage = require('@google-cloud/storage')
const setup = require('./setup')

const storage = new Storage()

// Methods for polling Cloudflare Logpull API and posting to SCC API
class Engine {
  constructor () {
    this.setup = setup
    this._zones = []
    this.cfOrg = setup.cf.orgID
    this.bucketName = setup.bucket
  }

  set zones (mach) {
    this._zones.push(mach)
  }

  get zones () {
    return this._zones
  }

  addZones () {
    return this.setup.cf
      .api({ zid: '' })
      .then(async json => {
        mkdirp('./tmp')
        for (let i = 0; i < json.result.length; i++) {
          this.zones = json.result[i].id
          fs.writeFileSync(`./tmp/${this.zones[i]}.txt`)
        }
      }).catch(err => {
        console.log('Error setting machines, reinitializing connection. ', err)
        return this.start()
      })
  }

  pollEvents () {
    const start = moment().startOf('minute').subtract(6, 'minutes').toISOString()
    const end = moment().startOf('minute').subtract(5, 'minutes').toISOString()
    const fields = `ClientRequestURI,ClientRequestHost,ClientRequestMethod,ClientRequestProtocol,ClientSSLCipher,ClientSSLProtocol,EdgeRateLimitAction,EdgeRateLimitID,EdgeStartTimestamp,WAFAction,WAFFlags,WAFMatchedVar,WAFProfile,WAFRuleID,WAFRuleMessage,ClientIP,EdgeColoID,OriginIP,ClientCountry,ClientRequestUserAgent,RayID`
    cron.schedule(`* * * * *`, () => {
      console.log(`Polled ELS on:`)
      for (let i = 0; i < this.zones.length; i++) {
        console.log(this.zones[i])
        const endpoint = `https://api.cloudflare.com/client/v4/zones/${this.zones[i]}/logs/received?start=${start}&end=${end}&fields=${fields}`
        console.log(endpoint)
        const stream = fs.createWriteStream(`./tmp/${this.zones[i]}.txt`)
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
          this.uploadToGoogle(`./tmp/${this.zones[i]}.txt`)
        })
      }
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

  start () {
    return Promise.resolve(this.addZones()).then(values => {
      return this
    }).catch(e => {
      console.log('Reinitializing connection')
      return this.start()
    })
  }

  reset () {
    return Promise.resolve(() => {
      delete this._zones
      this.zones = []
      return this
    }).catch(() => {
      return this.start()
    })
  }
}

module.exports = Engine
