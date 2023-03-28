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

function cleanUpSelects(response: any) {
  (response.configParams || []).forEach((paramEntry) => {
    // check options has the correct format, then remove it so we're not dependent on data from demo.matomo.cloud
    // staying constant for our tests
    if (paramEntry.options) {
      expect(paramEntry.options).toBeInstanceOf(Array);
      paramEntry.options.forEach((option) => {
        expect(typeof option.label).toEqual('string');
        expect(typeof option.value).toEqual('string');
      });
    }
    paramEntry.options = [];
  });
  return response;
}

// TODO: remove option name/value pairs in responses so we're not dependent on what data demo.matomo.cloud returns

describe('config', () => {
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

  describe('getConfig', () => {
    it('should return expected response when on the first step', async () => {
      let result = await Clasp.run('getConfig', {});
      result = cleanUpSelects(result);
      expect(result).toEqual(getExpectedResponse(result, 'config', 'step1'));
    });

    it('should return expected response if the first step selection is invalid', async () => {
      await expect(async () => {
        await Clasp.run('getConfig', {
          configParams: {
            idsite: 0,
          },
        });
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    });

    it('should return expected response when on the second step', async () => {
      let result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 1,
        },
      });
      result = cleanUpSelects(result);
      expect(result).toEqual(getExpectedResponse(result, 'config', 'step2'));
    });

    it('should return expected response if the second step selection is invalid', async () => {
      await expect(async () => {
        await Clasp.run('getConfig', {
          configParams: {
            idsite: 1,
            reportCategory: '   ',
          },
        });
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    });

    it('should return expected response when on the third step', async () => {
      let result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 1,
          reportCategory: 'Referrers',
        },
      });
      result = cleanUpSelects(result);
      expect(result).toEqual(getExpectedResponse(result, 'config', 'step3'));
    });

    it('should return expected response if the third step selection is invalid', async () => {
      await expect(async () => {
        await Clasp.run('getConfig', {
          configParams: {
            idsite: 1,
            reportCategory: 'Referrers',
            report: '   ',
          },
        });
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    });

    it('should return expected response when on the fourth and final step', async () => {
      let result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 1,
          reportCategory: 'Referrers',
          report: 'getWebsites',
        },
      });
      result = cleanUpSelects(result);
      expect(result).toEqual(getExpectedResponse(result, 'config', 'step4'));
    });
  });
});
