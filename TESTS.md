## Tests

This document details the list of manual tests that should be done before publishing a release and
details how the automated tests work.

## Manual Testing

TODO:

### Automated tests

The automated tests exist within the `./tests/appscript` directory and can be run via the `npm test` command.

These tests use Jest, but unlike normal unit tests, execute functions within apps script to provide fuller coverage.
(The alternative would be using mocks for all app script libraries, but given how many are used and how often they
are used within the connector code, this would result in some very weak tests.)

The result of the executed function calls are inspected or compared with a predefined expected result.

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
