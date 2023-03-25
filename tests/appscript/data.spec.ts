/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import Clasp from '../utilities/clasp';
import getExpectedResponse from './getExpectedResponse';

describe('data', () => {
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

  describe('getSchema', () => {
    // TODO
  });

  describe('getData', () => {
    //TODO
  });
});
