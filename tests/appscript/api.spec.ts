/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { beforeEach, beforeAll, expect } from '@jest/globals';
import Clasp from '../utilities/clasp';
import makeMockServer from './api/mockServer';

describe('api', () => {
  let server: ReturnType<typeof makeMockServer>;
  let tunnel;

  if (process.env.USE_LOCALTUNNEL) {
    beforeAll(async () => {
      // create localtunnel
      const localtunnel = (await import('localtunnel')).default;
      tunnel = await localtunnel({port: 3000});
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
      server = makeMockServer(3000, {
        onRandomError() {
          requestCount += 1;
        },
      });

      // use the mock server's path that forces a random error
      const result = await Clasp.run('setCredentials', {
        userToken: {
          username: `${ tunnel.url }/forced-random-error/`,
          token: 'ignored',
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
      expect(requestCount).toEqual(5);
    }, 300000);

    it('should not retry if a probably non-random error is returned', async () => {
      if (!process.env.USE_LOCALTUNNEL) {
        console.log('*** SKIPPING TEST ***');
        return;
      }

      let requestCount = 0;
      server = makeMockServer(3000, {
        onNonRandomError() {
          requestCount += 1;
        },
      });

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
      server = makeMockServer(3000, {
        onNonRandomError() {
          requestCount += 1;
        },
      });

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
  });
});
