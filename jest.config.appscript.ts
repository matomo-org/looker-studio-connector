/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

export default {
  rootDir: 'tests/appscript',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  globalSetup: './globalSetup.js',
  globalTeardown: './globalTeardown.js',
  maxWorkers: 1, // since we run our tests within apps script, we can't run them in parallel
  setupFiles: ['dotenv/config'],
};
