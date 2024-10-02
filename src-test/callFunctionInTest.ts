/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import ALL_FIXTURES from './mock-fixtures/all';

export function callFunctionInTest(functionName: string, testName: string, ...params: unknown[]) {
  try {
    console.log(`calling ${functionName} in test "${testName}"`);

    // there is no global object (like window) in apps script, so this is how we get a global function by name
    const fn = eval(functionName);
    const result = fn(...params);
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ ...e, message: e.message, stack: e.stack });
  }
}

export function callFunctionInTestWithMockFixture(
  functionName: string,
  fixture: { name: string, params: unknown[] },
  testName: string,
  ...params: unknown[]
) {
  const fixtureInstance = (ALL_FIXTURES[fixture.name])(...params);
  fixtureInstance.setUp();
  try {
    return callFunctionInTest(functionName, testName, ...params);
  } finally {
    fixtureInstance.tearDown();
  }
}
