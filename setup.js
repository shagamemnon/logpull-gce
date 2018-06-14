'use strict'

const request = require('request-promise-native')

let setup = {
  bucket: process.env.BUCKET,
  cf: {
    email: process.env.EMAIL,
    apiKey: process.env.API_KEY,
    zoneName: process.env.ZONE,
    org: process.env.ORG,
    orgID: '',

    options: {
      'Content-Type': 'application/json',
      'X-Auth-Email': process.env.EMAIL,
      'X-Auth-Key': process.env.API_KEY
    },

    apiCall (target = 'accounts') {
      return request({
        uri: `https://api.cloudflare.com/client/v4/${target}`,
        headers: this.options,
        json: true
      })
    }
  }
}

module.exports = setup
