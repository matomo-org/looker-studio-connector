# Looker Studio Connector for Matomo

TODO: add docs regarding how tests work in TESTING.md file

## Setting Up for Development

TODO: move relevant below documentation to here

## Setting Up for Deployment

TODO: move relevant below documentation to here

## Useful commands

Installing clasp:

```
$ npm install # clasp is included as a dev dependency
$ npm run clasp -- login
```

### Creating the App Script instance

```
$ npm run create
```

### Push to apps script

```
$ npm run clasp -- push
```

### Deploy the currently pushed code to Apps Script

```
$ npm run clasp -- deploy # this will automatically create a new version
```

## Tests

### Unit tests

**Using a new project for GCP for unit tests**

TODO: the linked instructions aren't as clear as they could be, list the whole steps here as well (w/ details)

See instructions here: https://github.com/google/clasp/blob/master/docs/run.md#setup-instructions. Make sure
to run all clasp commands through npm, for example, instead of `clasp setting ...`, `npm run clasp -- setting ...`.

(To create a GCP project: https://cloud.google.com/resource-manager/docs/creating-managing-projects#console)
(To get the GCP project number: https://cloud.google.com/resource-manager/docs/creating-managing-projects#identifying_projects)
(When setting the GCP project for the App Script project, there is no "Resources" tab. Instead go to "Project Settings".)
(When creating oauth credentials, make sure to enable app script api first.)

**Using an existing project**

TODO

### Integration tests

## Manual Testing

TODO: 
