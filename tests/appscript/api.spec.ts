/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { beforeEach } from '@jest/globals';
import Clasp from '../utilities/clasp';

describe('api', () => {
  beforeEach(async () => {
    await Clasp.run('clearEnvInTest');
  });

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
          Authorization: `Basic ${Buffer.from(`myuser:`).toString('base64')}`,
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
});
