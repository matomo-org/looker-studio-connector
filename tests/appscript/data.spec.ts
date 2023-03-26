/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Clasp from '../utilities/clasp';
import getExpectedResponse from './getExpectedResponse';

const DATE_TO_TEST = '2023-02-15';

describe('data', () => {
  beforeAll(async () => {
    await Clasp.run('setCredentials', {
      userToken: {
        username: 'https://demo.matomo.cloud/',
        token: 'anonymous',
      },
    });
  });

  afterAll(async () => {
    await Clasp.run('clearEnvInTest');
  });

  describe('getSchema', () => {
    const methodsTested = {};
    global.ALL_REPORT_METADATA.forEach((r) => {
      const method = `${r.module}.${r.action}`;
      if (methodsTested[method]) {
        return;
      }

      methodsTested[method] = true;

      if (process.env.ONLY_TEST_METHOD && process.env.ONLY_TEST_METHOD !== method) { // TODO: document
        return;
      }

      it(`should correctly map the schema for ${method}`, async () => {
        let result = await Clasp.run('getSchema', {
          configParams: {
            idsite: 1,
            report: method,
          },
        });
        expect(result).toEqual(getExpectedResponse('schema', `${method}`));
      });
    });
  });

  describe('getData', () => {
    const methodsTested = {};
    global.ALL_REPORT_METADATA.forEach((r) => {
      const method = `${r.module}.${r.action}`;
      if (methodsTested[method]) {
        return;
      }

      methodsTested[method] = true;
      if (process.env.ONLY_TEST_METHOD && process.env.ONLY_TEST_METHOD !== method) { // TODO: document
        return;
      }

      // TODO: test w/ requested fields
      // TODO: test failure w/o dateRange

      it(`should correctly map the schema & data for ${method}`, async () => {
        let result = await Clasp.run('getData', {
          configParams: {
            idsite: 1,
            report: method,
            filter_limit: 5,
          },
          dateRange: {
            startDate: DATE_TO_TEST,
            endDate: DATE_TO_TEST,
          },
        });
        expect(result).toEqual(getExpectedResponse('data', `${method}`));
      });
    });
  });
});
