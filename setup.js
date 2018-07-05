'use strict'

const { getSchema } = require('./GCS-To-Big-Query/index')

const schema = {
  _schema: '',

  get latest () {
    return this._schema
  },

  set latest (json) {
    return Promise.resolve(json).then(sch => {
      sch.map(obj => {
        this._schema += `${obj.name},`
      })
    })
  }
}

schema.latest = getSchema()

module.exports = schema.latest
