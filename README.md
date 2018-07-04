### Install
`npm install`
`gcloud app deploy`
`gsutil mb gs://cf-els-processor`

### Run
```bash
API_KEY='CLOUDFLARE_API_KEY' EMAIL='name@cloudflarecustomer.com' ZONE='example.com' ORG='CF_ORG_NAME' BUCKET='GCE_BUCKET_NAME' node index.js
```


`gcloud beta functions deploy cf-els-cloud-func --entry-point=index --trigger-http --stage-bucket=cf-els-processor`
