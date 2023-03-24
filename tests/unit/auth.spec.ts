/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Clasp from '../utilities/clasp';

describe('auth', () => {
  beforeEach(async () => {
    await Clasp.run('clearEnvInTest');
  });

  describe('setCredentials', () => {
    it('should store valid credentials', async () => {
      const result = await Clasp.run('setCredentials', {
        userToken: {
          username: 'https://demo.matomo.cloud/',
          token: 'anonymous',
        },
      });

      expect(result).toEqual({
        errorCode: 'NONE',
      });

      const isValid = await Clasp.run('isAuthValid');
      expect(isValid).toEqual(true);
    });

    it('should not store invalid credentials', async () => {
      const result = await Clasp.run('setCredentials', {
        userToken: {
          username: 'https://demo.matomo.cloud/',
          token: 'invalidauth',
        },
      });

      expect(result).toEqual({
        errorCode: 'INVALID_CREDENTIALS',
      });

      const isValid = await Clasp.run('isAuthValid');
      expect(isValid).toEqual(false);
    });
  });

  describe('getAuthType', () => {
    it('should return the correct response', async () => {
      const response = await Clasp.run('getAuthType');
      expect(response).toEqual({
        "helpUrl": "https://matomo.org/TODO",
        "type": "USER_TOKEN",
      });
    });
  });

  describe('resetAuth', () => {
    it('should clear the persisted auth', async () => {
      const result = await Clasp.run('setCredentials', {
        userToken: {
          username: 'https://demo.matomo.cloud/',
          token: 'anonymous',
        },
      });

      expect(result).toEqual({
        errorCode: 'NONE',
      });

      let isValid = await Clasp.run('isAuthValid');
      expect(isValid).toEqual(true);

      await Clasp.run('resetAuth');

      isValid = await Clasp.run('isAuthValid');
      expect(isValid).toEqual(false);
    });
  });
});
