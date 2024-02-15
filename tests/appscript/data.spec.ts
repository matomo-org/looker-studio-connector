/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Clasp from '../utilities/clasp';
import getExpectedResponse from './getExpectedResponse';
import env from '../env';

const DATE_TO_TEST = '2023-02-15';
const RANGE_START_DATE_TO_TEST = '2023-02-15';
const RANGE_END_DATE_TO_TEST = '2023-02-19';

const MATOMO_PERIODS_TO_TEST = {
  week: ['2023-02-13', '2023-02-19'],
  month: ['2023-02-01', '2023-02-28'],
  year: ['2022-01-01', '2022-12-31'],
};

function hasNoMetrics(r) {
  return !r.metrics
    && !r.processedMetrics
    && !r.metricsGoal
    && !r.processedMetricsGoal;
}

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

  describe('getMatomoSemanticTypeToLookerMapping', () => {
    it('should have a mapping for every metric type encountered in Matomo', async () => {
      const mapping = await Clasp.run('getMatomoSemanticTypeToLookerMapping');

      let unrecognizedMetricTypes: string[] = [];
      global.ALL_REPORT_METADATA.forEach((r) => {
        if (!r.metricTypes) {
          return;
        }

        Object.values(r.metricTypes as Record<string, string>).forEach((type) => {
          if (!mapping[type]
            && !unrecognizedMetricTypes.includes(type)
          ) {
            unrecognizedMetricTypes.push(type);
          }
        });
      });

      expect(unrecognizedMetricTypes).toEqual([]);
    });
  });

  describe('detectMatomoPeriodFromRange', () => {
    it('should correctly detect when a requested date range is a single day', async () => {
      const detected = await Clasp.run('detectMatomoPeriodFromRange', {
        startDate: DATE_TO_TEST,
        endDate: DATE_TO_TEST,
      });

      expect(detected).toEqual('day');
    });

    for (let [period, dates] of Object.entries(MATOMO_PERIODS_TO_TEST)) {
      it(`should correctly detect when a requested date range is a ${period} in Matomo`, async () => {
        const detected = await Clasp.run('detectMatomoPeriodFromRange', {
          startDate: dates[0],
          endDate: dates[1],
        });

        expect(detected).toEqual(period);
      });
    }
  });

  describe('getSchema', () => {
    it('should use the configured language', async () => {
      const result = await Clasp.run('getSchema', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Actions', apiAction: 'getPageTitles' }),
          filter_limit: 5,
          language: 'fr',
        },
      });
      expect(result).toEqual(getExpectedResponse(result, 'schema', 'Actions.getPageTitles_withLanguage'));
    });

    it('should report an error if the user does not specify a report', async () => {
      await expect(async () => {
        await Clasp.run('getSchema', {
          configParams: {
            idsite: env.APPSCRIPT_TEST_IDSITE,
          },
        });
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    });

    it('should report an error if the user specifies a filter_limit that is not an integer', async () => {
      await expect(async () => {
        await Clasp.run('getSchema', {
          configParams: {
            idsite: env.APPSCRIPT_TEST_IDSITE,
            report: JSON.stringify({ apiModule: 'API', apiAction: 'get' }),
            filter_limit: 'skldfjasdf',
          },
        });
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    });

    it('should report an error if the (somehow) a non-existant report is specified', async () => {
      await expect(async () => {
        await Clasp.run('getSchema', {
          configParams: {
            idsite: env.APPSCRIPT_TEST_IDSITE,
            report: JSON.stringify({ apiModule: 'Referrers', apiAction: 'getNonexistentReport' }),
          },
        });
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    });

    const methodsTested = {};
    global.ALL_REPORT_METADATA.forEach((r) => {
      if (hasNoMetrics(r)) {
        return;
      }

      const method = `${r.module}.${r.action}`;

      const reportParams = JSON.stringify({ ...r.parameters, apiModule: r.module, apiAction: r.action });
      if (methodsTested[reportParams]) {
        return;
      }

      methodsTested[reportParams] = true;

      if (process.env.ONLY_TEST_METHOD && process.env.ONLY_TEST_METHOD !== method) {
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
    it('should use the configured language', async () => {
      const result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Actions', apiAction: 'getPageTitles' }),
          filter_limit: 5,
          language: 'fr',
        },
        dateRange: {
          startDate: DATE_TO_TEST,
          endDate: DATE_TO_TEST,
        },
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'Actions.getPageTitles_withLanguage'));
    });

    it('should use the configured segment', async () => {
      const result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Actions', apiAction: 'getPageTitles' }),
          filter_limit: 5,
          segment: 'countryCode==nz',
        },
        dateRange: {
          startDate: DATE_TO_TEST,
          endDate: DATE_TO_TEST,
        },
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'Actions.getPageTitles_withSegment'));
    });

    it('should detect if the script run time is past a certain point and abort with a clear message', async () => {
      await Clasp.setScriptProperties({
        SCRIPT_RUNTIME_LIMIT: '0.01',
        MAX_ROWS_TO_FETCH_PER_REQUEST: '1',
      });

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

    it('should paginate through results correctly when row count is > MAX_ROWS_TO_FETCH_PER_REQUEST', async () => {
      await Clasp.setScriptProperties({
        MAX_ROWS_TO_FETCH_PER_REQUEST: '1',
      }, true);

      let result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Actions', apiAction: 'getPageUrls' }),
          filter_limit: 5,
        },
        dateRange: {
          startDate: DATE_TO_TEST,
          endDate: DATE_TO_TEST,
        },
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'Actions.getPageUrls_withLowMaxRowsToFetchPerRequest'));
    });

    it('should only include requested fields', async () => {
      await Clasp.run('setScriptProperties', {}, true);

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

    it('should correctly include dimension when requested fields contains label', async () => {
      await Clasp.run('setScriptProperties', {}, true);

      let result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Actions', apiAction: 'getPageTitles' }),
          filter_limit: 5,
        },
        dateRange: {
          startDate: DATE_TO_TEST,
          endDate: DATE_TO_TEST,
        },
        fields: [
          { name: 'nb_visits' },
          { name: 'label' }, // check it works when label is not first
          { name: 'nb_hits' },
        ],
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'Actions.getPageTitles_withRequestedFields'));
    });

    it('should correctly include dimensions when in requested fields for report w/ multiple dimensions', async () => {
      await Clasp.run('setScriptProperties', {}, true);

      let result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Events', apiAction: 'getName' }),
          filter_limit: 5,
        },
        dateRange: {
          startDate: DATE_TO_TEST,
          endDate: DATE_TO_TEST,
        },
        fields: [
          { name: 'nb_events' },
          { name: 'Events_EventAction' },
          { name: 'Events_EventName' },
          { name: 'max_event_value' },
        ],
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'Events.getName_withRequestedFields'));
    });


    it('should return all data when no filter limit is set', async () => {
      await Clasp.setScriptProperties({
        MAX_ROWS_TO_FETCH_PER_REQUEST: '500',
      }, true);

      let result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Actions', apiAction: 'getPageUrls' }),
        },
        dateRange: {
          startDate: '2024-02-13',
          endDate: '2024-02-13',
        },
      });

      expect((result as any).rows).toHaveLength(1080);
    }, 300000);

    it('should fail gracefully when no dateRange is specified', async () => {
      await Clasp.setScriptProperties({}, true);

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

    for (let limit of ['-1', '0', 'sadlfjk']) {
      it('should fail if an invalid filter_limit is specified', async () => {
        await expect(async () => {
          await Clasp.run('getData', {
            configParams: {
              idsite: env.APPSCRIPT_TEST_IDSITE,
              report: JSON.stringify({ apiModule: 'API', apiAction: 'get' }),
              filter_limit: limit,
            },
            dateRange: {
              startDate: '2024-02-13',
              endDate: '2024-02-13',
            },
          });
        }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
      });
    }

    it('should report an error if a report can no longer be found in the report metadata', async () => {
      await expect(async () => {
        await Clasp.run('getData', {
          configParams: {
            idsite: env.APPSCRIPT_TEST_IDSITE,
            report: JSON.stringify({ apiModule: 'NonexistentPlugin', apiAction: 'get' }),
            filter_limit: 5,
          },
          dateRange: {
            startDate: RANGE_START_DATE_TO_TEST,
            endDate: RANGE_END_DATE_TO_TEST,
          },
        });
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    }, 300000);

    for (let [period, dates] of Object.entries(MATOMO_PERIODS_TO_TEST)) {
      it(`should correctly fetch data when the date range matches a matomo ${period}`, async () => {
        let result = await Clasp.run('getData', {
          configParams: {
            idsite: env.APPSCRIPT_TEST_IDSITE,
            report: JSON.stringify({ apiModule: 'Events', apiAction: 'getName' }),
            filter_limit: 5,
          },
          dateRange: {
            startDate: dates[0],
            endDate: dates[1],
          },
        });
        expect(result).toEqual(getExpectedResponse(result, 'data', `Events.getName_${period}`));
      });
    }

    it('should fetch data by day when the date dimension is requested', async () => {
      let result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Events', apiAction: 'getName' }),
          filter_limit: 5,
        },
        dateRange: {
          startDate: RANGE_START_DATE_TO_TEST,
          endDate: RANGE_END_DATE_TO_TEST,
        },
        fields: [
          { name: 'date' },
          { name: 'nb_events' },
          { name: 'Events_EventAction' },
          { name: 'Events_EventName' },
          { name: 'max_event_value' },
        ],
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'Events.getName_withDateDimension'));
    });

    it('should paginate correctly when fetch data by day when the date dimension is requested', async () => {
      await Clasp.setScriptProperties({
        MAX_ROWS_TO_FETCH_PER_REQUEST: '1',
      }, true);

      let result = await Clasp.run('getData', {
        configParams: {
          idsite: env.APPSCRIPT_TEST_IDSITE,
          report: JSON.stringify({ apiModule: 'Events', apiAction: 'getName' }),
          filter_limit: 5,
        },
        dateRange: {
          startDate: RANGE_START_DATE_TO_TEST,
          endDate: RANGE_END_DATE_TO_TEST,
        },
        fields: [
          { name: 'date' },
          { name: 'nb_events' },
          { name: 'Events_EventAction' },
          { name: 'Events_EventName' },
          { name: 'max_event_value' },
        ],
      });
      expect(result).toEqual(getExpectedResponse(result, 'data', 'Events.getName_withDateDimension'));
    });

    it('should correctly fetch data for a date range spanning multiple days', async () => {
      await Clasp.run('setScriptProperties', {}, true);

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
      if (hasNoMetrics(r)) {
        return;
      }

      const method = `${r.module}.${r.action}`;

      const reportParams = JSON.stringify({ ...r.parameters, apiModule: r.module, apiAction: r.action });
      if (methodsTested[reportParams]) {
        return;
      }

      methodsTested[reportParams] = true;
      if (process.env.ONLY_TEST_METHOD && process.env.ONLY_TEST_METHOD !== method) {
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
