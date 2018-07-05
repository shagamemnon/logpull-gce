const gulp = require('gulp')
const { exec } = require('child_process')
const run = require('gulp-run')
const sequence = require('run-sequence')
const inquirer = require('inquirer')
const fs = require('fs')
const config = require('./config.json')
const opn = require('opn')
const { auth } = require('google-auth-library')
const writeJson = require('write')
var gutil = require('gulp-util')
const request = require('request')

// var prompts = new Rx.Subject()
// use gulp-run to start a pipeline
// cd ~/scc-cloudflare &&
const client = auth.getClient({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
})

const ui = new inquirer.ui.BottomBar()

const createConfigJSON = () => {
  let credentials

  var billingPrompt = {
    type: 'list',
    name: 'billing',
    message: 'Is billing enabled for this project?',
    choices: ['Yes', 'No']
  }

  const billingEnabled = {
    type: 'list',
    name: 'apiKeyPrePrompt',
    prefix: '',
    message: `Next, you'll need your Cloudflare API key.`,
    choices: ['Get my API key from dash.cloudflare.com', 'I have my API key accessible']
  }

  const cloudflareApiKeyPrompt = {
    type: 'input',
    name: 'cfApiKey',
    message: '\nEnter your Cloudflare API key:'
  }

  const cloudflareEmailPrompt = {
    type: 'input',
    name: 'cfEmail',
    prefix: '',
    message: 'Enter your Cloudflare account email:'
  }

  const cloudflareZonesPrompt = {
    type: 'input',
    name: 'cfZones',
    prefix: '>',
    message: `\nEnter each top-level domain you'd like to monitor logs for:`
  }

  let projectId

  function main () {
    auth.getDefaultProjectId().then(proj => {
      projectId = proj
      return enterTollRoad(projectId)
    })
  }

  function enterTollRoad (projectId) {
    return inquirer.prompt(billingPrompt).then(answers => {
      answers.billing === 'Yes' ? addBillingStatus(projectId, 'done')
        : addBillingStatus(projectId, 'incomplete')
    })
  }

  function addBillingStatus (projectId, status) {
    if (status === 'incomplete') opn(`https://console.developers.google.com/project/${projectId}/settings`)
    setTimeout(function () {
      return inquirer.prompt(billingEnabled).then(answers => {
        answers.apiKeyPrePrompt === 'Get my API key from dash.cloudflare.com' ? addCloudflareCredentials('redirect')
          : addCloudflareCredentials()
      })
    }, 1000)
  }

  function addCloudflareCredentials (routeTo) {
    if (routeTo === 'redirect') {
      console.log('Opening Cloudflare dashboard ...')
      opn(`https://dash.cloudflare.com/profile`)
    }
    setTimeout(function () {
      return inquirer.prompt([cloudflareApiKeyPrompt, cloudflareEmailPrompt]).then(answers => {
        credentials = {
          API_KEY: `${answers['cfApiKey']}`,
          EMAIL: `${answers['cfEmail']}`,
          LOGPULL_START_TIME: 6,
          LOGPULL_END_TIME: 5,
          BUCKET_NAME: 'cloudflare-els-storage',
          FUNCTION_NAME: 'cloudflare-els-gcs',
          FUNCTION_BUCKET_NAME: 'cloudflare-els-cloud-functions',
          GCLOUD_PROJECT_ID: projectId,
          ZONE_NAMES: [],
          ZONES: [],
          SCHEMA: []
        }
        return createCredentialsFile(credentials)
      })
    }, 1000)
  }

  let configureZones = {
    _zones: [],
    _zoneNames: [],
    setZones (hdrs) {
      request({
        uri: `https://api.cloudflare.com/client/v4/zones`,
        headers: hdrs,
        json: true
      }).then(json => {
        for (let i = 0; i < json.result.length; i++) {
          this._zones.push(json.result[i].id)
          this._zoneNames.push(json.result[i].name)
          console.log(this._zones, this._zoneNames)
          if (i >= json.result.length) {
            return [this._zones, this._zoneNames]
          }
        }
      }).then(vals => {
        return Promise.resolve([this._zones, this._zoneNames])
      })
    }
  }

  function createCredentialsFile (credentials) {
    try {
      const schema = require('./setup')
      console.log(credentials)
      const hdrs = {
        'X-Auth-Key': credentials.API_KEY,
        'X-Auth-Email': credentials.EMAIL
        // 'Content-Type': 'application/json'
      }
      console.log(hdrs)
      return configureZones.setZones(hdrs).then(async zoneConfig => {
        credentials.ZONES = zoneConfig[0]
        credentials.ZONE_NAMES = zoneConfig[1]
        credentials.SCHEMA = await schema
        return credentials
      }).then(credentials => {
        return writeJson.sync('config.json', credentials)
      })
    } catch (e) {
      if (e) {
        console.log('Cloudflare credentials invalid.')
        addCloudflareCredentials()
      }
    }
  }
  main()
}

gulp.task('configureCredentials', function (cb) {
  createConfigJSON()
  cb()
})

gulp.task('createBuckets', function (cb) {
  var cmd = new run.Command(`gsutil mb gs://${credentials.BUCKET_NAME} && gsutil defacl set public-read gs://${credentials.BUCKET_NAME}`)
  console.log('Creating storage buckets')
  cmd.exec()
  cb()
})

gulp.task('deploy', function (cb) {
  var cmd = new run.Command(`gcloud beta functions deploy ${credentials.FUNCTION_NAME} --source=. --stage-bucket=${credentials.FUNCTION_BUCKET_NAME} --trigger-resource-${credentials.BUCKET_NAME} --trigger-event google.storage.object.finalize --entry-point=index`)
  cmd.exec()
  cb()
})

gulp.task('enableapis', function (cb) {
  var cmd = new run.Command('npm run enableapis')
  console.log('Waiting for APIs to enable')
  cmd.exec()
  cb()
})
