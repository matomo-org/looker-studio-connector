/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import * as path from 'path';
import * as fs from 'fs';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Clasp from '../utilities/clasp';

function getExpectedResponse(suiteName: string, testName: string) {
  const expectedFilePath = path.join(__dirname, 'expected', `${suiteName}_${testName}.json`);
  const contents = fs.readFileSync(expectedFilePath).toString('utf-8');
  return JSON.parse(contents);
}

// TODO: remove option name/value pairs in responses so we're not dependent on what data demo.matomo.cloud returns

describe('config', () => {
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

  describe('getConfig', () => {
    it('should return expected response when on the first step', async () => {
      const result = await Clasp.run('getConfig', {});
      expect(result).toEqual(getExpectedResponse('config', 'step1'));
    });

    it('should return expected response if the first step selection is invalid', async () => {
      const result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 0,
        },
      });
      expect(result).toEqual(getExpectedResponse('config', 'step1_invalid'));
    });

    it('should return expected response when on the second step', async () => {
      const result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 1,
        },
      });
      expect(result).toEqual(getExpectedResponse('config', 'step2'));
    });

    it('should return expected response if the second step selection is invalid', async () => {
      const result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 1,
          reportCategory: '   ',
        },
      });
      expect(result).toEqual(getExpectedResponse('config', 'step2_invalid'));
    });

    it('should return expected response when on the third step', async () => {
      const result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 1,
          reportCategory: 'Referrers',
        },
      });
      expect(result).toEqual(getExpectedResponse('config', 'step3'));
    });

    it('should return expected response if the third step selection is invalid', async () => {
      const result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 1,
          reportCategory: 'Referrers',
          report: '   ',
        },
      });
      expect(result).toEqual(getExpectedResponse('config', 'step3_invalid'));
    });

    it('should return expected response when on the fourth and final step', async () => {
      const result = await Clasp.run('getConfig', {
        configParams: {
          idsite: 1,
          reportCategory: 'Referrers',
          report: 'getWebsites',
        },
      });
      expect(result).toEqual(getExpectedResponse('config', 'step4'));
    });
  });
});
