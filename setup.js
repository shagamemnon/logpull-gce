'use strict'

const request = require('request-promise-native')
const config = require('./config.json')
// const { getSchema, jsonLoad } = require('./GCS-To-Big-Query/index')

let setup = {
  bucket: config.BUCKET,
  logpullStart: config.START_TIME || 6,
  logpullEnd: config.END_TIME || 5,

  email: config.EMAIL,
  apiKey: config.API_KEY,
  _zones: [],
  _zoneNames: [],
  _schema: '',

  headers: {
    'Content-Type': 'application/json',
    'X-Auth-Email': config.EMAIL,
    'X-Auth-Key': config.API_KEY
  },

  get zones () {
    return this._zones
  },

  get zoneNames () {
    return this._zoneNames
  },

  set schema (field) {
    this._schema += field.toString()
  },

  get schema () {
    return this._schema
  },

  set zones (target) {
    return request({
      uri: `https://api.cloudflare.com/client/v4/${target}`,
      headers: setup.headers,
      json: true
    }).then(json => {
      for (let i = 0; i < json.result.length; i++) {
        this._zones.push(json.result[i].id)
        this._zoneNames.push(json.result[i].name)
      }
    })
  },

  set schema (json) {
    return Promise.resolve(json()).then(sch => {
      sch.map(obj => {
        setup.schema = obj.name
      })
    })
  },

  set settings (x) {
    this.schema = x()
    this.zones = 'zones'
  },

  get settings () {
    return setup
  }
}

module.exports = () => {
  const { getSchema } = require('./GCS-To-Big-Query/index')
  setup.settings = getSchema()
  return setup.settings
}
