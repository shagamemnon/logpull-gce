'use strict'

const fetch = require('node-fetch')

let setup = {
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

    api ({
      zid: zid = '',
      contentType: contentType = 'json',
      base: base = 'https://api.cloudflare.com/client/v4',
      endpoint: endpoint = `/zones`,
      path: path = ''
    }) {
      const target = `${base}${endpoint}/${zid.trim()}${path.trim()}`
      return fetch(target, { headers: this.options }).then(res => {
        if (contentType === 'json') {
          return res.json()
        } else {
          return res.text()
        }
      })
    }
  },

  bucket: process.env.BUCKET,

  start () {
    return new Promise((resolve, reject) => {
      fetch('https://api.cloudflare.com/client/v4/accounts', { headers: setup.cf.options }).then(res => { return res.json() }).then(json => {
        console.log()
        json.result.map(org => {
          if (org.name === setup.cf.org) {
            console.log(`Found organization ${org.name} (id: ${org.id})`)
            delete setup.start
            setup.cf.orgID = org.id
            resolve()
          }
        })
      })
    })
  }
}

module.exports = setup
