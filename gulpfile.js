const gulp = require('gulp')
const { exec } = require('child_process')
const run = require('gulp-run')
const sequence = require('run-sequence')
const inquirer = require('inquirer')
const fs = require('fs')
const config = require('./config.json')
const opn = require('opn')
const { auth } = require('google-auth-library')
const writeFile = require('write')
var gutil = require('gulp-util')
const request = require('got')

// var prompts = new Rx.Subject()
// use gulp-run to start a pipeline
// cd ~/scc-cloudflare &&
const client = auth.getClient({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
})

const ui = new inquirer.ui.BottomBar()

const createConfigJSON = () => {
  var billingPrompt = {
    type: 'list',
    name: 'billing',
    message: 'Is billing enabled for this project?',
    choices: ['Yes', 'No'],
    context: 0
  }

  const billingEnabled = {
    type: 'list',
    name: 'apiKeyPrePrompt',
    prefix: '> ',
    message: '\nPress enter to open https://dash.cloudflare.com/profile and get your Cloudflare API Key',
    choices: ['Get API Key from the Cloudflare dashboard'],
    context: 0
  }

  const cloudflareDashboardPrompt = {
    type: 'input',
    name: 'cfApiKey',
    prefix: '?',
    message: '\nEnter your Cloudflare API key: https://dash.cloudflare.com/profile',
    context: 0
  }

  const cloudflareEmailPrompt = {
    type: 'input',
    name: 'cfEmail',
    prefix: '?',
    message: '\nEnter your Cloudflare account email:',
    context: 0
  }

  const cloudflareZonesPrompt = {
    type: 'input',
    name: 'cfZones',
    prefix: '>',
    message: `\nEnter each top-level domain you'd like to monitor logs for:`,
    context: 0
  }

  let projectId

  let credentials

  function main () {
    auth.getDefaultProjectId().then(proj => {
      projectId = proj
      return enterTollRoad(projectId)
    })
  }

  function enterTollRoad (projectId) {
    return inquirer.prompt(billingPrompt).then(answers => {
      answers.billing === 'Yes' ? addCloudflareCredentials(projectId)
        : goToBilling(projectId)
    })
  }

  function goToBilling (projectId) {
    opn(`https://console.developers.google.com/project/${projectId}/settings`)
    setTimeout(function () {
      return inquirer.prompt(billingEnabled).then(answers => {
        answers.apiKeyPrePrompt === 'Get API Key from the Cloudflare Dashboard' ? goToCloudflareDashboard() : enterTollRoad()
      })
    }, 2000)
  }

  function goToCloudflareDashboard () {
    opn(`https://dash.cloudflare.com/profile`)
    setTimeout(function () {
      return inquirer.prompt([cloudflareDashboardPrompt, cloudflareEmailPrompt]).then(answers => {
        credentials = {
          API_KEY: `${answers['cfApiKey']}`,
          EMAIL: `${answers['cfEmail']}`,
          LOGPULL_START_TIME: 6,
          LOGPULL_END_TIME: 5,
          BUCKET_NAME: 'cloudflare-els-storage',
          FUNCTION_NAME: 'cloudflare-els-gcs',
          FUNCTION_BUCKET_NAME: 'cloudflare-els-cloud-functions',
          GCLOUD_PROJECT_ID: projectId
        }
      })
    }, 2000)
  }

  function enterCloudflareCredentials () {
    opn(`https://dash.cloudflare.com/profile`)
    setTimeout(function () {
      return inquirer.prompt(cloudflareDashboardPrompt).then(answers => {
        answers.apiKeyPrePrompt === 'Get my API Key' ? goToCloudflareDashboard() : enterTollRoad()
      })
    }, 2000)
  }

  function addCloudflareCredentials () {
    return inquirer.prompt([

    ]).then(answers => {
      try {
        const hdrs = {
          'X-Auth-Key': `${answers['cfApiKey']}`,
          'X-Auth-Email': `${answers['cfEmail']}`,
          'Content-Type': 'application/json'
        }
        console.log(hdrs)
        request.stream('https://api.cloudflare.com/client/v4/zones', { headers: hdrs })
          .on('response', res => {
            console.log(res.status)
          })
        config.start(hdrs).then(success => {
          writeFile('config.json', credentials, JSON.stringify(credentials, null, 2))
            .then(function () {
              console.log(credentials)
              console.log('Success. To start deployment run:\nnpm run initialize')
            })
        }).then(success => {
        })
      } catch (e) {
        if (e) console.log('Cloudflare credentials invalid, please re-enter gulp cloudflare.start')
      }
    })
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
