/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { beforeEach, beforeAll, expect } from '@jest/globals';
import Clasp from '../utilities/clasp';
import { makeApiFailureMockServer } from './api/mockServer';
import axios from 'axios';

describe('api', () => {
  let server: ReturnType<typeof makeApiFailureMockServer>;
  let tunnel;

  if (process.env.USE_LOCALTUNNEL) {
    beforeAll(async () => {
      const localtunnel = (await import('../utilities/mwp-localtunnel-client')).default;

      tunnel = await localtunnel({
        port: 3000,
        host: process.env.USE_LOCALTUNNEL,
      });

      if ( ! tunnel.url ) {
        throw new Error('Failed to setup localtunnel!');
      }
    });

    beforeAll(async () => {
      await Clasp.run('clearEnvInTest');
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
      await Clasp.run('clearEnvInTest');

      await tunnel.close();
    });
  }

  async function waitForMockServer() {
    const currentTest = expect.getState().currentTestName;

    const testUrl = `${tunnel.url}/index.php`;
    const body = {
      method: 'SitesManager.getSitesIdWithAtLeastViewAccess',
    };

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (currentTest !== expect.getState().currentTestName) { // test timed out
        return;
      }

      try {
        const response = await axios.post(testUrl, body);
        if (Array.isArray(response.data) && response.data[0] === 1) {
          return;
        }
      } catch (e) {
        // retry
      }
    }
  }

  describe('extractBasicAuthFromUrl()', () => {
    const URLS_WITHOUT_CREDENTIALS = [
      'http://mymatomo.com/',
      'https://mymatomo.com/',
      'https://mymatomo.site.com/index.php',
      'http://mymatomo.site.com/index.php?param=value',
    ];

    URLS_WITHOUT_CREDENTIALS.forEach((url, i) => {
      it(`should extract nothing from URLs without credentials (#${i})`, async () => {
        const result = await Clasp.run('extractBasicAuthFromUrl', url);

        expect(result).toEqual({
          authHeaders: {},
          urlWithoutAuth: url,
        });
      });
    });

    it('should correctly extract credentials when a username is supplied alone', async () => {
      const result = await Clasp.run('extractBasicAuthFromUrl', 'http://myuser@mymatomo.com');

      expect(result).toEqual({
        authHeaders: {
          Authorization: `Basic ${Buffer.from('myuser:').toString('base64')}`,
        },
        urlWithoutAuth: 'http://mymatomo.com',
      });
    });

    it('should correctly extract credentials when a username is supplied with an empty password', async () => {
      const result = await Clasp.run('extractBasicAuthFromUrl', 'http://myuser:@mymatomo.com');

      expect(result).toEqual({
        authHeaders: {
          Authorization: `Basic ${Buffer.from(`myuser:`).toString('base64')}`,
        },
        urlWithoutAuth: 'http://mymatomo.com',
      });
    });

    it('should correctly extract credentials when a username is supplied with a password', async () => {
      const pass = 'my$@!p/\\ass';

      const result = await Clasp.run(
        'extractBasicAuthFromUrl',
        `http://myuser:${encodeURIComponent(pass)}@mymatomo.com`,
      );

      expect(result).toEqual({
        authHeaders: {
          Authorization: `Basic ${Buffer.from(`myuser:${pass}`).toString('base64')}`,
        },
        urlWithoutAuth: 'http://mymatomo.com',
      });
    });
  });

  describe('fetchAll()', () => {
    beforeAll(async () => {
      await Clasp.setScriptProperties({
        SCRIPT_RUNTIME_LIMIT: '30',
      });
    });

    afterAll(async () => {
      await Clasp.setScriptProperties({}, true);
    });

    it('should retry if a probably random error is returned', async () => {
      if (!process.env.USE_LOCALTUNNEL) {
        console.log('*** SKIPPING TEST ***');
        return;
      }

      let requestCount = 0;
      server = makeApiFailureMockServer(3000, {
        onRandomError() {
          requestCount += 1;
        },
      });

      await waitForMockServer();

      // use the mock server's path that forces a random error
      const result = await Clasp.run('setCredentials', {
        userToken: {
          username: `${ tunnel.url }/forced-random-error/`,
          token: 'forcedrandomerror',
        },
      });

      expect(result).toEqual({ errorCode: 'NONE' });

      await expect(async () => {
        await Clasp.run('fetchAll',
          [
            {
              method: 'SomePlugin.someMethod',
              params: {
                idSite: '123',
              },
            },
          ],
          {
            checkRuntimeLimit: true,
          },
        );
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible

      // check that the request was retried by looking at our request count
      expect(requestCount).toBeGreaterThanOrEqual(4);
    }, 300000);

    it('should not retry if a probably non-random error is returned', async () => {
      if (!process.env.USE_LOCALTUNNEL) {
        console.log('*** SKIPPING TEST ***');
        return;
      }

      let requestCount = 0;
      server = makeApiFailureMockServer(3000, {
        onNonRandomError() {
          requestCount += 1;
        },
      });

      // waiting seems to be required here, or the mock server isn't used in time
      await waitForMockServer();

      // use the mock server's path that forces a non-random error
      await Clasp.run('setCredentials', {
        userToken: {
          username: `${ tunnel.url }/forced-nonrandom-error/`,
          token: 'ignored',
        },
      });

      const response = await Clasp.run('fetchAll',
        [
          {
            method: 'SomePlugin.someMethod',
            params: {
              idSite: '123',
            },
          },
        ],
      );

      expect(response).toEqual([{
        message: 'Matomo server failed with code 400. Truncated response: test 400',
        result: 'error',
      }]);

      // check that the request was only made once
      expect(requestCount).toEqual(1);
    });

    it('should throw if at least one request errors and throw on error is true', async () => {
      if (!process.env.USE_LOCALTUNNEL) {
        console.log('*** SKIPPING TEST ***');
        return;
      }

      let requestCount = 0;
      server = makeApiFailureMockServer(3000, {
        onNonRandomError() {
          requestCount += 1;
        },
      });

      await waitForMockServer();

      // use the mock server's path that forces a non-random error
      await Clasp.run('setCredentials', {
        userToken: {
          username: `${ tunnel.url }/forced-nonrandom-error/`,
          token: 'ignored',
        },
      });

      await expect(async () => {
        await Clasp.run('fetchAll',
          [
            {
              method: 'SitesManager.getSitesIdWithAtLeastViewAccess',
            },
            {
              method: 'SomePlugin.someMethod',
              params: {
                idSite: '123',
              },
            },
          ],
          {
            throwOnFailedRequest: true,
          },
        );
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible

      // check that the request was only made once
      expect(requestCount).toEqual(1);
    });

    it('should abort when UrlFetchApp throws an unknown error', async () => {
      if (!process.env.USE_LOCALTUNNEL) {
        console.log('*** SKIPPING TEST ***');
        return;
      }

      server = makeApiFailureMockServer(3000);

      await waitForMockServer();

      // use the mock server's path that forces a non-random error
      await Clasp.run('setCredentials', {
        userToken: {
          username: `${ tunnel.url }/`,
          token: 'ignored',
        },
      });

      const errorMessage = 'unknown error';

      await expect(async () => {
        await Clasp.runWithFixture(
          { name: 'urlfetchapp', params: [ errorMessage ] },
          'fetchAll',
          [
            {
              method: 'SitesManager.getSitesIdWithAtLeastViewAccess',
            },
          ],
          {
            throwOnFailedRequest: true,
          },
        );
      }).rejects.toHaveProperty('message', errorMessage);

      await expect(async () => {
        await Clasp.runWithFixture(
          { name: 'urlfetchapp', params: [ errorMessage, true ] },
          'fetchAll',
          [
            {
              method: 'SitesManager.getSitesIdWithAtLeastViewAccess',
            },
          ],
          {
            throwOnFailedRequest: true,
          },
        );
      }).rejects.toHaveProperty('message', errorMessage);
    });

    const TEMPORARY_ERRORS = [
      {
        name: 'address unavailable',
        errorMessage: 'Address unavailable: test.whatever.com/index.php?',
      },
      {
        name: 'dns error',
        errorMessage: 'DNS error: https://matomo.whatever.com/index.php?',
      },
      {
        name: 'urlfetchapp property',
        errorMessage: 'Unexpected error while getting the method or property fetchAll on object UrlFetchApp.',
      },
    ];

    TEMPORARY_ERRORS.forEach(({ name, errorMessage }) => {
      it(`should retry when UrlFetchApp throws a "${name}" temporary error`, async () => {
        if (!process.env.USE_LOCALTUNNEL) {
          console.log('*** SKIPPING TEST ***');
          return;
        }

        server = makeApiFailureMockServer(3000);

        await waitForMockServer();

        // use the mock server's path that forces a non-random error
        await Clasp.run('setCredentials', {
          userToken: {
            username: `${ tunnel.url }/`,
            token: 'ignored',
          },
        });

        // check it does not throw when an Error is used
        await Clasp.runWithFixture(
          { name: 'urlfetchapp', params: [ errorMessage ] },
          'fetchAll',
          [
            {
              method: 'SitesManager.getSitesIdWithAtLeastViewAccess',
            },
          ],
          {
            throwOnFailedRequest: true,
          },
        );

        // check it does not throw when a string is used
        await Clasp.runWithFixture(
          { name: 'urlfetchapp', params: [ errorMessage, true ] },
          'fetchAll',
          [
            {
              method: 'SitesManager.getSitesIdWithAtLeastViewAccess',
            },
          ],
          {
            throwOnFailedRequest: true,
          },
        );
      });
    });

    it('should abort with a readable error message when a quota limit reached error is thrown', async () => {
      if (!process.env.USE_LOCALTUNNEL) {
        console.log('*** SKIPPING TEST ***');
        return;
      }

      server = makeApiFailureMockServer(3000);

      await waitForMockServer();

      // use the mock server's path that forces a non-random error
      await Clasp.run('setCredentials', {
        userToken: {
          username: `${ tunnel.url }/`,
          token: 'ignored',
        },
      });

      await expect(async () => {
        await Clasp.runWithFixture(
          { name: 'urlfetchapp', params: [ 'Service invoked too many times for one day: urlfetch.' ] },
          'fetchAll',
          [
            {
              method: 'SitesManager.getSitesIdWithAtLeastViewAccess',
            },
          ],
          {
            throwOnFailedRequest: true,
          },
        );
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible

      await expect(async () => {
        await Clasp.runWithFixture(
          { name: 'urlfetchapp', params: [ 'Service invoked too many times for one day: urlfetch.', true ] },
          'fetchAll',
          [
            {
              method: 'SitesManager.getSitesIdWithAtLeastViewAccess',
            },
          ],
          {
            throwOnFailedRequest: true,
          },
        );
      }).rejects.toHaveProperty('message', 'Exception'); // actual data studio error message does not appear to be accessible
    });
  });

  describe('isApiErrorNonRandom()', function () {
    const testCases = [
      {
        type: 'unknown report',
        message: 'Requested report CustomReports.getCustomReport for Website id=1 not found in the list of available reports.',
        expected: true,
      },
      {
        type: 'VisitTime.getByDayOfWeek with multiple sites/dates',
        message: 'VisitTime.getByDayOfWeek does not support multiple dates.',
        expected: true,
      },
      {
        type: 'plugin no longer enabled',
        message: 'The plugin Funnels is not enabled.',
        expected: true,
      },
      {
        type: 'entity does not exist',
        message: 'Dimension 999 for website 1 does not exist',
        expected: true,
      },
      {
        type: 'unauthorized access to resource',
        message: 'You can\'t access this resource as it requires \'admin\' access for the website id = 3.',
        expected: true,
      },
      {
        type: 'unexpected website found',
        message: 'An unexpected website was found in the request: website id was set to \'10\'',
        expected: true,
      },
      {
        type: 'Referrers.getAll with multiple sites/dates',
        message: 'Referrers.getAll with multiple sites or dates is not supported (yet).',
        expected: true,
      },
    ];

    testCases.forEach(function ({ type, message, expected }) {
      it(`should return ${expected ? 'true' : 'false'} for '${type}' error messages`, async function () {
        const actual = await Clasp.run('isApiErrorNonRandom', message);
        expect(expected).toEqual(actual);
      });
    });
  });
});
