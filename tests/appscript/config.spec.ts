/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import localtunnel from 'mwp-localtunnel-client';
import Clasp from '../utilities/clasp';
import getExpectedResponse from './getExpectedResponse';
import env from '../env';
import { makeMatomo4MockServer } from './api/mockServer';

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

      paramEntry.options = [];
    }
  });
  return response;
}

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

    if (process.env.USE_LOCALTUNNEL) {
      describe('#localtunnel tests', () => {
        let server: ReturnType<typeof makeMatomo4MockServer>;
        let tunnel;

        if (process.env.USE_LOCALTUNNEL) {
          beforeAll(async () => {
            // create localtunnel
            tunnel = await localtunnel({
              port: 3000,
              host: process.env.USE_LOCALTUNNEL,
            });
          });

          afterEach(async () => {
            if (server) {
              await new Promise((r) => {
                server.close(r);
              });
              server = null;
            }
          });

          afterAll(async () => {
            await tunnel.close();
          });
        }

        it('should return the expected response when the Matomo version is < 4.14', async () => {
          server = makeMatomo4MockServer(3000);

          // use the mock server's path that forces a non-random error
          const setCredentialsResult = await Clasp.run('setCredentials', {
            userToken: {
              username: tunnel.url,
              token: 'ignored',
            },
          });

          expect(setCredentialsResult).toEqual({ errorCode: 'NONE' });

          let result = await Clasp.run('getConfig', {});
          result = cleanUpSelects(result);
          expect(result).toEqual(getExpectedResponse(result, 'config', 'oldMatomoVersion'));
        });
      });
    }
  });
});
