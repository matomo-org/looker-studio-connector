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
  $ npm run clasp -- deploy -V <VERSION> -d Production
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

# Customizing a Deployment

Several environment variables can be set in a `.env` file at the root of this repo to customize a deploy.
These variables and what they affect are listed below, and their default values are located in `./src/env.ts`.

Also note that each variable can also be set dynamically as a Script Property in the Apps Script settings.

* `DEBUG`: whether to deploy with debug mode enabled or not. By default this is set to 0. When this is enabled,
  isAdminUser() returns true, which will show any debug text in error messages. Extra console.log() calls
  will be made as well.

* `CONFIG_REQUEST_CACHE_TTL_SECS`: determines whether and how long certain API requests sent during the
  connector configuration phase should be cached. Since the `getConfig()` function can be called several
  times during configuration, either due to stepped config or due to users going back and forth, it can be
  inefficient to send API requests every time when the response is very unlikely to have changed.

* `MAX_ROWS_TO_FETCH_PER_REQUEST`: when requesting data for a report, the connector fetches the entire data
  set in pieces (this is to get around the 50mb max HTTP response size imposed by Apps Script). This variable
  determines the number of rows that are fetched at once.

* `SCRIPT_RUNTIME_LIMIT`: apps script functions have a maximum time they are allowed to run. This connector
  tries to detect when retrieving data has been running close to that limit, and provides a useful error
  message to the user. This variable controls the amount of time before `getData()` will abort and provide
  this error message.

* `API_REQUEST_SOURCE_IDENTIFIER`: this variable defines the name of an extra query parameter that is sent
  along with Matomo API requests. Adding the parameter helps to identify requests that come from the Looker
  Studio connector in case you want to see how much load the connector is adding to your Matomo instance(s).

* `API_REQUEST_RETRY_LIMIT_IN_SECS`: when API requests to your Matomo instance fail the connector will retry
  them after a delay. It will continue to do so until the requests succeed or a certain amount of time has
  passed since we started trying. This variable controls how long to wait before the connector just gives up
  and stops retrying.

* `API_REQUEST_EXTRA_HEADERS`: extra HTTP headers to send in requests to Matomo. For use during development
  if using, for example, a localhost tunneling service like ngrok. Should be set to a JSON stringified object
  such as `{"ngrok-skip-browser-warning":"1"}`.
