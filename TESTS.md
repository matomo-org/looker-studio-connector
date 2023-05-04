## Tests

This document details the list of manual tests that should be done before publishing a release and
details how the automated tests work.

## Manual Testing

### Before testing

**Push latest code**

Before doing any manual tests you should ensure the code you are testing is up-to-date.

To push your code locally to Apps Script, run:

```
$ npm run push
```

This will print out a link at the end that will load the deployed connector in Looker Studio.

Record that link. It will be referred to in the steps below as `<LINK_TO_CONNECTOR>`.

**Revoke access to any existing instances of the connector**

1. Open [https://lookerstudio.google.com/u/0/datasources/create](https://lookerstudio.google.com/u/0/datasources/create) in a browser.
2. Search for `matomo`, and look for entries that have the Matomo logo and say `By InnoCraft Ltd`.
3. For each one of those, click the kebab menu icon in the upper right corner and select "Revoke access".

You may need to do this multiple times when testing connector authentication.

### Connector Authentication

_Note: automated tests for this functionality also exist._

**Check authentication fails with invalid credentials**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter invalid pairs of instance URL/credentials in the "Matomo Connector" box that displays and click `Submit`.

Expected: a toast saying the credentials are invalid displays.

**Check authentication succeeds with valid instance URL, but invalid token**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and an invalid token and click `Submit`.

Expected: a toast saying the credentials are invalid displays.

**Check authentication succeeds with a valid instance URL and a valid token**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and a valid token (eg, `anonymous`) and click `Submit`.

   Note: for the instance URL, it is expected that any URL variation that ends w/ a `/` or `/index.php` will also work.

Expected: the connector configuration screen displays.

### Basic Connector Configuration

**Check it is not possible to set an empty Website**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and a valid token (eg, `anonymous`) and click `Submit`.
4. Do not enter anything in the `Website/Measurable` field and click `Next`.

Expected: it should not save and the `Website/Measurable` prompt should re-appear.

**Only websites the user has at least view access to are shown in the Website drop down**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and a valid token (eg, `anonymous`) and click `Submit`.
4. Open the `Website/Measurable` select.

Expected: it should only show sites the user associated with the token has at least view access to.

**Selecting a website shows the rest of the connector configuration**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and a valid token (eg, `anonymous`) and click `Submit`.
4. Open the `Website/Measurable` select and select a website. Click `Next`.

Expected:
* the `Report` dropdown should have every report available for the selected site. This should include Goals reports for the site's goals
  and any CustomDimension reports + premium reports, etc. Each report should be prepended with the report category.
* the `Segment` dropdown should have the list of stored segments that are available for the site and user. It should be the same
  list of segments the user sees when logged in to Matomo and when the site used is selected. By default "All Visits" should be selected.
* the `Default Row Limit` input should be empty. Hovering over the `?` icon next to it should display help text. By default it should be empty.

**Connecting without selecting a report fails**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and a valid token (eg, `anonymous`) and click `Submit`.
4. Open the `Website/Measurable` select and select a website. Click `Next`.
5. Click `Connect` without selecting a report.

Expected: an error is displayed to the user telling the user to select a report.

**Connecting with an invalid Default Row Limit fails**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and a valid token (eg, `anonymous`) and click `Submit`.
4. Open the `Website/Measurable` select and select a website. Click `Next`.
5. Select a report. Enter a non-integer in the `Default Row Limit` field.
6. Click `Connect`.

Expected: an error is displayed to the user telling the user to input a valid limit or leave it empty.

**Connecting with valid configuration succeeds**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and a valid token (eg, `anonymous`) and click `Submit`.
4. Open the `Website/Measurable` select and select a website. Click `Next`.
5. Select a report and enter a valid integer for the row limit or leave it empty.
6. Click `Connect`.

Expected: the add data source workflow proceeds to the schema display. Information about dimensions, metrics and
parameters should be shown.

### Report Creation w/ Matomo as a Data Source

**Creating a report after configuring a connector succeeds**

1. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
2. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
3. Enter a valid Matomo instance URL (eg, `https://demo.matomo.cloud`) and a valid token (eg, `anonymous`) and click `Submit`.
4. Open the `Website/Measurable` select and select a website. Click `Next`.
5. Select a report and enter a valid integer for the row limit or leave it empty.
6. Click `Connect`.
7. Click `Create Report`.
8. In the next page that loads, confirm by clicking the `Add to report` button, if it shows up.

Expected: after a small wait, the Matomo report will be displayed in a table.

**Adding another report as a new data source from within a Looker Studio report succeeds**

1. Open a Looker Studio report that already contains a connected Matomo report.
2. Open the `Data` tab on the right if it is not already open.
3. In the lower right there is a `Add Data` button/option. Click it.
4. In the bottom sheet that opens, search for `matomo`.
5. Find the connector that says `Matomo Connector` and `By InnoCraft Ltd` and select it.
6. Select a website and click `Next`.
7. Select a report, preferably a different one than what's in the existing Looker Studio report.
8. Click `Add` at the bottom right of the bottom sheet. (If a modal asking to confirm the choice pops up, confirm.)

Expected: in the `Data` pane there should be a new `Matomo Connector` instance for the new report. The dimension and metrics
of the new report should be visible when the connector row is expanded.

**Reports with multiple dimensions when flattened display correctly in Looker Studio**

1. Open a Looker Studio report that already contains a connected Matomo report.
2. Open the `Data` tab on the right if it is not already open.
3. In the lower right there is a `Add Data` button/option. Click it.
4. In the bottom sheet that opens, search for `matomo`.
5. Find the connector that says `Matomo Connector` and `By InnoCraft Ltd` and select it.
6. Select a website and click `Next`.
7. Select a report with multiple dimensions like `Event Names`.
8. Click `Add` at the bottom right of the bottom sheet. (If a modal asking to confirm the choice pops up, confirm.)
9. Check in the `Data` pane for the new `Matomo Connector` row and expand it.

Expected: there are multiple dimensions, one for each table/subtable of the selected report (For Events.getNames
this would be `Event Name` and `Event Action`).

10. Drag a dimension from the new connector to the report to create a new chart. Add the other dimension to it and some metrics.

Expected: the dimensions and metrics display in the chart without error.

**Reports with no dimensions display correctly in Looker Studio**

1. Open a Looker Studio report that already contains a connected Matomo report.
2. Open the `Data` tab on the right if it is not already open.
3. In the lower right there is a `Add Data` button/option. Click it.
4. In the bottom sheet that opens, search for `matomo`.
5. Find the connector that says `Matomo Connector` and `By InnoCraft Ltd` and select it.
6. Select a website and click `Next`.
7. Select a report with no dimensions like `API > Main metrics`.
8. Click `Add` at the bottom right of the bottom sheet. (If a modal asking to confirm the choice pops up, confirm.)
9. Check in the `Data` pane for the new `Matomo Connector` row and expand it.

Expected: there are no dimensions and many metrics.

10. Drag a metric from the new connector to the report to create a chart for a single metric.

Expected: the metric value displays without error.

11. In the chart properties field, change the displayed metric to some other ones.

Expected: every metric displays without error.

**Metrics can be added and removed from visualizations in Looker Studio**

1. Open a Looker Studio report that already contains a connected Matomo report.
2. Open the `Data` tab on the right if it is not already open.
3. In the lower right there is a `Add Data` button/option. Click it.
4. In the bottom sheet that opens, search for `matomo`.
5. Find the connector that says `Matomo Connector` and `By InnoCraft Ltd` and select it.
6. Select a website and click `Next`.
7. Select a report with multiple metrics (which should be any of them).
8. Click `Add` at the bottom right of the bottom sheet. (If a modal asking to confirm the choice pops up, confirm.)
9. Check in the `Data` pane for the new `Matomo Connector` row and expand it.
10. Drag a **dimension** from the new connector to the report to create a chart for it.

Expected: the chart displays with the dimension and no metrics without error.

11. Select the new chart and in the properties pane add a couple metrics.

Expected: the metrics display and load correctly in the chart without error.

12. Remove some metrics.

Expected: the chart loads without the metrics without error.

**Reports with dimensions can have single metric views**

_Not yet supported._

### Requesting data with different date ranges

**Reports can be loaded for a single day**

1. Open a Looker Studio report that already contains a connected Matomo report.
2. Open the `Data` tab on the right if it is not already open.
3. In the lower right there is a `Add Data` button/option. Click it.
4. In the bottom sheet that opens, search for `matomo`.
5. Find the connector that says `Matomo Connector` and `By InnoCraft Ltd` and select it.
6. Select a website and click `Next`.
7. Select a report and click `Add` at the bottom right of the bottom sheet. (If a modal asking to confirm the choice pops up, confirm.)
8. Check in the `Data` pane for the new `Matomo Connector` row and expand it.
9. Drag a **dimension** from the new connector to the report to create a chart for it.
10. Select the new chart and in the properties pane, add some metrics.
11. In the properties pane, look for the "Default date range" section. Change it to a custom date range for a single day.

Expected: the chart displays the metrics without error and the data in the chart matches the data in the target Matomo instance for that day.

**Reports can be loaded for arbitrary ranges**

1. Open a Looker Studio report that already contains a connected Matomo report.
2. Open the `Data` tab on the right if it is not already open.
3. In the lower right there is a `Add Data` button/option. Click it.
4. In the bottom sheet that opens, search for `matomo`.
5. Find the connector that says `Matomo Connector` and `By InnoCraft Ltd` and select it.
6. Select a website and click `Next`.
7. Select a report and click `Add` at the bottom right of the bottom sheet. (If a modal asking to confirm the choice pops up, confirm.)
8. Check in the `Data` pane for the new `Matomo Connector` row and expand it.
9. Drag a **dimension** from the new connector to the report to create a chart for it.
10. Select the new chart and in the properties pane, add some metrics.
11. In the properties pane, look for the "Default date range" section. Change it to an arbitrary custom date range.

Expected: the chart displays the metrics without error and the data in the chart matches the data in the target Matomo instance for that same date range.

### Looker Studio feature: re-aggregation

**Summary row support**

_Not yet supported.**

**Default aggregation of Matomo metrics.**

_Not yet supported.**

### Other

**Pre-requisites**

These tests involve using a localhost tunneling service, specifically ngrok. You will need to have Matomo
installed locally and have ngrok setup.

First, ensure you have a token auth you can use for your local Matomo and get it ready.

Sign up for a free account at ngrok.com and go through the setup. Start forwarding your local Matomo.

Then in the `.env` file in this repo, set `API_REQUEST_EXTRA_HEADERS` to `{"ngrok-skip-browser-warning":"1"}`
and run `npm run push`.

**API requests to Matomo are retried w/ exponential backoff**

1. Force an error in Matomo by adding `throw new \Exception('test exception message');` in `plugins/API/API.php`
   in the `getReportMetadata()` method.
2. Open `https://lookerstudio.google.com/datasources/create?connectorId=<LINK_TO_CONNECTOR>`
3. Click the `Authorize` button and authorize Looker Studio to use your Google account if needed.
4. Enter the ngrok public URL for the instance URL and a token for a user in your local Matomo.
5. Open the `Website/Measurable` select and select a website. Click `Next`.

Expected: the loading gif will show continuously for about two minutes, after which an error message is shown to the user.
The error message includes the `'test exception message'` string and has links to forum support and an email to get support.

6. Open the app script logs and find the execution for `getConfig()` with the request that failed.

Expected: there are console log messages of the format `1 request(s) failed, retrying after N seconds.` where the number
of seconds multiplies by two for each attempt, to some upper limit.

### Graceful failure if plugin being used is deactivated/uninstalled

1. Open a Looker Studio report that already contains a connected Matomo report.
2. Open the `Data` tab on the right if it is not already open.
3. In the lower right there is a `Add Data` button/option. Click it.
4. In the bottom sheet that opens, search for `matomo`.
5. Find the connector that says `Matomo Connector` and `By InnoCraft Ltd` and select it.
6. Select a website and click `Next`.
7. Select a report for a plugin that can be deactivated (like a premium plugin) and click `Add` at the bottom right of the bottom sheet. (If a modal asking to confirm the choice pops up, confirm.)
8. Check in the `Data` pane for the new `Matomo Connector` row and expand it.
9. Drag a **dimension** from the new connector to the report to create a chart for it.
10. Select the new chart and in the properties pane, add **one** metric.

Expected: the chart displays with data.

11. In your local Matomo, deactivate the plugin that's being used.
12. In Looker Studio, add one more metric (to make Looker Studio refresh).

Expected: the chart should display an error.

13. Click 'See Details'.

Expected: the modal that displays has a detailed error message and lists how to get help.

### Automated tests

#### The tests are failing suddenly, what do I do?

The automated tests are run against `https://demo.matomo.cloud` so if something changes in the deploy there (say
a new plugin is enabled or a bug is introduced that affects the connector), the tests in the connector will start
to fail. This is by design.

If you are a developer tasked with fixing these tests, here's how you would go about it:

**without running the connector yourself**

If you do not have your own dev environment for the connector setup, and the test failures are simple (say
there are new reports in demo.matomo.cloud so there are now some missing expected test files), you can simply
edit the expected files in `tests/appscript/expected` based on the github action output.

**the testing locally way**

If you have your own dev environment for the connector setup, you can run the specific failing tests by:

* adding a `.only(` to the test's source
* running the test via `npm test -- ./tests/appscript/failingtest.spec.ts` (replace `failingtest` with the name of the spec file)

This will allow you to debug the connector, inserting console.log() lines and checking the output in Apps Script.

Read the relevant section in README.md to get setup for development. Read below if you need to write new tests.

#### Test System Documentation

The automated tests exist within the `./tests/appscript` directory and can be run via the `npm test` command.

These tests use Jest, but unlike normal unit tests, execute functions within apps script to provide fuller coverage.
(The alternative would be using mocks for all app script libraries, but given how many are used and how often they
are used within the connector code, this would result in some very weak tests.)

The result of the executed function calls are inspected or compared with a predefined expected result.

**Test-only environment variables**

* **ONLY_TEST_METHOD**: if set to an API method like `DevicesDetection.getType`, the tests in data.spec.ts that are
  dynamically generated based on the available API methods in `https://demo.matomo.cloud` will only run for the value
  in `ONLY_TEST_METHOD`.

**Automating Apps Script function calls via clasp**

To call remote Apps Script functions from `node` locally, we use the `clasp` command line utility, specifically the
`clasp run` command.

The code for this automation is all in the `./tests/utilities/clasp.ts` file.

**Extra Apps Script code used in tests**

In order to automate the execution of Apps Script functions and reset the environment for proper testing, we need
to add a couple extra functions toe the Apps Script deploy. This code is stored in the `./src-test` folder and
consists of:

* **clearEnvInTest.ts**: contains the function `clearEnvInTest()` which clears the Apps Script `PropertyService` of
  all stored values. This service is used to store authentication details, which we don't want to persist after the
  execution of a single test.

* **callFunctionInTest.ts**: contains the function `callFunctionInTest()` which takes the name of a global function
  and a list of extra parameters to forward to it. It invokes the function (which should be a function defined in the
  connector code, such as, `getConfig`) and returns the result as a JSON string. If an exception occurs, the exception
  is returned as JSON (the exception is not propagated).

  We call this function in tests instead of the function we want to test directly, to ensure the output can be parsed
  and handed back to the test. If a string is not returned from a function, `clasp` will pretty print the JSON object which
  is harder to parse. Exceptions are just not printed out as JSON so they would also be harder to parse.

* **setScriptProperties**: contains the function `setScriptProperties` which is used to test environment variables used
  by the connector (since script properties can override values in the .env file).

**Global test setup**

The global setup code for the automated tests is defined in the `./tests/globalSetup.js` file which performs the
following tasks before any tests are run:

* a backup of the `./src/appsscript.json` file is made, and the file is then modified so anyone is allowed to use
  the `executionApi`. This is required to remotely call Apps Script functions during tests, but is not needed
  for the connector to function. (This change is reverted in `globalTeardown.js` after tests complete.)
* the `build:test` command is run, which runs rollup on the `src-test` folder.
* the compiled code in `dist` is then pushed to Apps Script via `clasp`
* then we start watching Apps Script log output to print out during test execution
* finally, some Matomo API requests are made to fetch data used to dynamically define test cases, since we can't
  do this within a `describe()` call.
