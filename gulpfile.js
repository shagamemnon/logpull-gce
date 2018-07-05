const gulp = require('gulp')
const run = require('gulp-run')
const inquirer = require('inquirer')
const opn = require('opn')
const { auth } = require('google-auth-library')
const writeFile = require('write')
const fetch = require('node-fetch')
const touch = require('touch')
const { getSchema } = require('./GCS-To-Big-Query/index')

let hdrs = {
  'X-Auth-Key': '',
  'X-Auth-Email': '',
  'Content-Type': 'application/json'
}

const uniqueBucketName = (unique) => {
  var coeff = 1000 * 60 * 5
  var date = new Date()
  unique = new Date(Math.round(date.getTime() / coeff) * coeff)
  return unique
}

console.log(uniqueBucketName())

let config = {
  LOGPULL_START_TIME: 6,
  LOGPULL_END_TIME: 5,
  BUCKET_NAME: `${'cloudflare-els-storage'}${Date.now()}`,
  FUNCTION_NAME: 'cloudflare-els-gcs',
  FUNCTION_BUCKET_NAME: 'cloudflare-els-cloud-functions',
  GCLOUD_PROJECT_ID: '',
  ZONE_NAMES: [],
  ZONES: [],
  FIELDS: ''
}

const createFile = (filename, obj) => {
  touch(filename, {}, () => {
    writeFile(filename, JSON.stringify(obj, null, 2), (err) => {
      if (err) console.log(err)
    })
  })
}

const client = auth.getClient({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
})

const ui = new inquirer.ui.BottomBar()

const createConfigJSON = () => {
  var billingPrompt = {
    type: 'list',
    name: 'billing',
    prefix: '\n',
    message: 'Is billing enabled for this project?',
    choices: ['Yes', 'No'],
    default: 'No'
  }

  const billingEnabled = {
    type: 'list',
    name: 'apiKeyPrePrompt',
    prefix: '\n',
    message: `Next, you'll need your Cloudflare API key.`,
    choices: ['Retrieve API key from dash.cloudflare.com', new inquirer.Separator(), 'I have my API key accessible'],
    default: 'Retrieve API key from dash.cloudflare.com'
  }

  const cloudflareApiKeyPrompt = {
    type: 'input',
    name: 'cfApiKey',
    prefix: '\n',
    message: 'Enter your Cloudflare API key:'
  }

  const cloudflareEmailPrompt = {
    type: 'input',
    name: 'cfEmail',
    prefix: '\n',
    message: 'Enter your Cloudflare account email:'
  }

  const cloudflareZonesPrompt = {
    type: 'input',
    name: 'cfZones',
    prefix: '\n',
    message: `Enter each top-level domain you'd like to monitor logs for:`
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
        answers.apiKeyPrePrompt === 'Get my API key from dash.cloudflare.com' ? addCloudflareConfig('redirect')
          : addCloudflareConfig()
      })
    }, 1000)
  }

  function addCloudflareConfig (routeTo) {
    if (routeTo === 'redirect') {
      console.log('Opening Cloudflare dashboard ...')
      opn(`https://dash.cloudflare.com/profile`)
    }
    setTimeout(function () {
      return inquirer.prompt([cloudflareApiKeyPrompt, cloudflareEmailPrompt]).then(answers => {
        hdrs['X-Auth-Key'] = `${answers['cfApiKey']}`
        hdrs['X-Auth-Email'] = `${answers['cfEmail']}`
        config.GCLOUD_PROJECT_ID = projectId
        return createConfigFile()
      })
    }, 1000)
  }

  async function setZones () {
    console.log(hdrs)
    return fetch('https://api.cloudflare.com/client/v4/zones', { headers: hdrs })
      .then(res => {
        return res.json()
      }).then(json => {
        console.log(json.result)
        for (let i = 0; i < json.result.length; i++) {
          config.ZONES.push(json.result[i].id)
          config.ZONE_NAMES.push(json.result[i].name)
          if (i >= json.result.length - 1) {
            console.log(i)
            return config
          }
        }
      })
  }

  async function getFields () {
    return getSchema()
      .then(sch => {
        return sch.map(obj => {
          if (!obj.name.includes('undefined')) config.FIELDS += `${obj.name},`
        })
      }).then(fields => {
        return config
      })
  }

  async function createConfigFile () {
    try {
      setZones().then(function () {
        console.log(config)
        createFile('credentials.json', hdrs)
        return getFields()
      }).then(function () {
        createFile('config.json', config)
      })
    } catch (e) {
      if (e) {
        console.log('Cloudflare config invalid.')
        addCloudflareConfig()
      }
    }
  }
  main()
}

gulp.task('configure', function (cb) {
  createConfigJSON()
  cb()
})

gulp.task('deploy', function (cb) {
  var makeBucket = new run.Command(`gsutil mb gs://${config.BUCKET_NAME}`)
  var cmd = new run.Command(`gcloud beta functions deploy ${config.FUNCTION_NAME} --source=. --stage-bucket=${config.FUNCTION_BUCKET_NAME} --trigger-http --entry-point=index`)
  makeBucket.exec()
  setTimeout(function () {
    cmd.exec()
  }, 5000)
  cb()
})

gulp.task('enableapis', function (cb) {
  var cmd = new run.Command('npm run enableapis')
  console.log('Waiting for APIs to enable')
  cmd.exec()
  cb()
})
