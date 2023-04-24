# Deployment

1. Create a deployment Google account. This account will host the apps script project and its deploys. Access to it should be restricted.

2. Create the Apps Script project using the deployment Google account. This can be done w/ the following commands:

  ```
  $ npm install
  $ npm run clasp -- login # login to the deployment Google account
  $ npm run create
  ```

3. Push and deploy the current code.

  ```
  $ npm run push
  $ npm run clasp -- deploy
  ```

4. Create a “Production” deployment:

  This can be done through the dashboard (https://developers.google.com/looker-studio/connector/deploy#create_separate_deployments) or via the CLI:

  ```
  $ npm run clasp -- deployments
  # note the latest version number in the output for ^
  $ npm run clasp -- deploy -V <VERSION> -d Production**
  ```

# Debugging a production deploy

**Debugging an error a user received**

Every unexpected error message user the connector throws includes a random execution ID and the time of the error. This
execution ID is in the log messages, so you can find the logs for this specific error by searching for the execution ID
and looking for an execution close to the time of the error.

**Debugging a reproducible error**

If an error can be reproduced, you can debug it in production by temporarily setting the `DEBUG` script property to 1
in the Apps Script project. The connector will start logging extra output. Reproduce the error, search for the execution
for that error, and inspect the debug logs.

Make sure to unset the `DEBUG` property when you are done.
