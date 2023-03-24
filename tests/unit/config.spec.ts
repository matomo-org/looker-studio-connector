/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Clasp from '../utilities/clasp';

describe('config', () => {
  beforeEach(async () => {
    await Clasp.run('clearEnvInTest');
  });

  describe('getConfig', () => {
    it('should run', async () => {
      await Clasp.run('setCredentials', {
        userToken: {
          username: 'https://demo.matomo.cloud/',
          token: 'anonymous',
        },
      });
      const result = await Clasp.run('getConfig', {});
      expect(result).toBeTruthy();
    });
  });
});
