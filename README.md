# Looker Studio Connector for Matomo

TODO: add docs regarding how tests work in TESTING.md file (remove below test sections when done)
TODO: follow all steps in blank install to test (on private google account to avoid using a new GCP project)

## Setting Up for Deployment

**Install clasp**

```
$ npm install # clasp is included as a dev dependency
$ npm run clasp -- login
```

**Create your App Script instance**

```
$ npm run create
```

**First push**

```
$ npm run push
```

## Setting Up for Development

To develop this connector you need to follow a couple more steps. They are specifically required to run the
app script and e2e tests.

First, follow all steps in **Setting Up for Deployment**. Then:

**Create a GCP project**

Follow the steps listed here: [https://cloud.google.com/resource-manager/docs/creating-managing-projects#creating_a_project]

TODO: the linked instructions aren't as clear as they could be, list the whole steps here as well (w/ details)

**Get the GCP Project number and ID**

Follow the steps listed here: [https://cloud.google.com/resource-manager/docs/creating-managing-projects#identifying_projects]

Record the number and ID somewhere.

**Use the GCP Project number in clasp**

Run:

```
$ npm run clasp -- setting projectId <PROJECT_ID>
```

**Setup OAuth for the GCP Project**

Visit: `https://console.cloud.google.com/apis/credentials/consent?project=<PROJECT_ID>`.

Set the **Application Name** to `clasp project`. Fill out the required email fields, then click `Save and continue` until
the wizard completes (you don't need to add any scopes).

See instructions here: https://github.com/google/clasp/blob/master/docs/run.md#setup-instructions. Make sure
to run all clasp commands through npm, for example, instead of `clasp setting ...`, `npm run clasp -- setting ...`.

**Set the GCP Project ID in apps script**

Run:

```
$ npm run clasp -- open
```

Click **Project Settings** on the left.

Enter the GCP Project number in **Google Cloud Platform (GCP) Project** section and save.

**Enable the Apps Script API**

Go to: `https://console.cloud.google.com/apis/dashboard?project=<PROJECT_ID>`

Click **Enable APIs & Services** and search for **Apps Script API**.

Click the **Apps Script API** search result and enable the API.

**Create OAuth credentials**

Run:

```
$ npm run clasp -- open --creds
```

Click **Create credentials > OAuth client ID**.

Select **Desktop App** for the application type.

Enter `clasp` for the name.

Click **Create**.

Download the client credentials and save it as creds.json in the root folder (it will be ignored via .gitignore).

Run:

```
$ clasp login --creds creds.json
```

Now you'll be able to run the app script and e2e tests via `npm run test:appscript` and `npm run test:e2e`.

## Useful commands

**Deploy a version**

```
$ npm run clasp -- deploy # marks the current HEAD as a new version
$ npm run clasp -- deployments # prints out existing deployments
```

## Tests

### Unit tests

**Using an existing project**

TODO

### Integration tests

## Manual Testing

TODO: 
