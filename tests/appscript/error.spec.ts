/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect } from '@jest/globals';
import Clasp from '../utilities/clasp';

describe('error', () => {
  describe('callWithUserFriendlyErrorHandling', () => {
    it('should catch uncaught exceptions and throw user friendly errors', async () => {
      await expect(async () => {
        await Clasp.run('callWithUserFriendlyErrorHandling_forceUncaught');
      }).rejects.toEqual({
        message: 'Exception', // actual data studio error message does not appear to be accessible
        isConnectorThrownError: true,
      });
    });

    it('should pass connector thrown errors through', async () => {
      await expect(async () => {
        await Clasp.run('callWithUserFriendlyErrorHandling_forceConnectorError');
      }).rejects.toEqual({
        message: 'Exception', // actual data studio error message does not appear to be accessible
        isConnectorThrownError: true,
      });
    });

    it('should catch looker studio uncaught errors and throw user friendly errors', async () => {
      await expect(async () => {
        await Clasp.run('callWithUserFriendlyErrorHandling_forceLookerStudioUncaught');
      }).rejects.toEqual({
        message: 'Exception', // actual data studio error message does not appear to be accessible
        isConnectorThrownError: true,
      });
    });
  });
});
