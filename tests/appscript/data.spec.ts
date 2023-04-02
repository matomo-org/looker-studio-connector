/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Clasp from '../utilities/clasp';
import getExpectedResponse from './getExpectedResponse';
import env from './env';

const DATE_TO_TEST = '2023-02-15';
const RANGE_START_DATE_TO_TEST = '2023-02-15';
const RANGE_END_DATE_TO_TEST = '2023-02-19';

describe('data', () => {
  beforeAll(async () => {
    await Clasp.run('setCredentials', {
      userToken: {
        username: env.APPSCRIPT_TEST_MATOMO,
        token: env.APPSCRIPT_TEST_TOKEN,
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

      const reportParams = JSON.stringify({ ...r.parameters, apiModule: r.module, apiAction: r.action });
      if (methodsTested[reportParams]) {
        return;
      }

      methodsTested[reportParams] = true;

      if (process.env.ONLY_TEST_METHOD && process.env.ONLY_TEST_METHOD !== method) { // TODO: document
        return;
      }

      const paramsSuffix = r.parameters ? `(${Object.entries(r.parameters).map(([k, v]) => `${k}_${v}`).join('_')})` : '';
      it(`should correctly map the schema for ${method}${paramsSuffix}`, async () => {
        let result = await Clasp.run('getSchema', {
          configParams: {
            idsite: env.APPSCRIPT_TEST_IDSITE,
            report: reportParams,
          },
        });
        expect(result).toEqual(getExpectedResponse(result, 'schema', `${method}${paramsSuffix}`));
      });
    });
  });

  describe('getData', () => {
    it('should only include requested fields', async () => {
      let result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'API', apiAction: 'get' }),
          filter_limit: 5,
        },
        dateRange: {
          startDate: DATE_TO_TEST,
          endDate: DATE_TO_TEST,
        },
        fields: [
          { name: 'nb_visits' },
          { name: 'nb_conversions' },
          { name: 'PagePerformance_domprocessing_time' },
        ],
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'API.get_withRequestedFields'));
    });

    it('should fail gracefully when no dateRange is specified', async () => {
      await expect(async () => {
        await Clasp.run('getData', {
          configParams: {
            idsite: env.APPSCRIPT_TEST_IDSITE,
            report: JSON.stringify({ apiModule: 'API', apiAction: 'get' }),
            filter_limit: 5,
          },
        });
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    });

    it('should correctly fetch data for a date range spanning multiple days', async () => {
      let result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'API', apiAction: 'get' }),
          filter_limit: 5,
        },
        dateRange: {
          startDate: RANGE_START_DATE_TO_TEST,
          endDate: RANGE_END_DATE_TO_TEST,
        },
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'API.get_withMultiDayDateRange'));
    });

    const methodsTested = {};
    global.ALL_REPORT_METADATA.forEach((r) => {
      const method = `${r.module}.${r.action}`;

      const reportParams = JSON.stringify({ ...r.parameters, apiModule: r.module, apiAction: r.action });
      if (methodsTested[reportParams]) {
        return;
      }

      methodsTested[reportParams] = true;
      if (process.env.ONLY_TEST_METHOD && process.env.ONLY_TEST_METHOD !== method) { // TODO: document
        return;
      }

      const paramsSuffix = r.parameters ? `(${Object.entries(r.parameters).map(([k, v]) => `${k}_${v}`).join('_')})` : '';
      it(`should correctly map the schema & data for ${method}${paramsSuffix}`, async () => {
        let result = await Clasp.run('getData', {
          configParams: {
            idsite: env.APPSCRIPT_TEST_IDSITE,
            report: reportParams,
            filter_limit: 5,
          },
          dateRange: {
            startDate: DATE_TO_TEST,
            endDate: DATE_TO_TEST,
          },
        });
        expect(result).toEqual(getExpectedResponse(result, 'data', `${method}${paramsSuffix}`));
      });
    });
  });
});
