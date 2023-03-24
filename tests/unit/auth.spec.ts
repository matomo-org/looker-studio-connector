/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect } from '@jest/globals';
import Clasp from '../utilities/clasp';

describe('auth', () => {
  describe('setCredentials', () => {
    it('should run', async () => {
      const result = await Clasp.run('setCredentials', {
        userToken: {
          username: 'https://demo.matomo.cloud/',
          token: 'anonymous',
        },
      });
      expect(result).toBeTruthy();
    });
  });
});
