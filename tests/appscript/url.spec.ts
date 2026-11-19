/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, expect, it } from '@jest/globals';
import { redactUrlCredentials } from '../../src/url';

describe('redactUrlCredentials', () => {
  it.each([
    ['password credentials', 'https://user:pass@host.com/index.php', 'https://host.com/index.php'],
    ['username only', 'https://user@host.com/index.php', 'https://host.com/index.php'],
    ['slash in password', 'https://user:pa/ss@host.com/index.php', 'https://host.com/index.php'],
    ['at sign in username', 'https://me@corp.com:s3cr/et@matomo.example/index.php', 'https://matomo.example/index.php'],
    ['at sign in query', 'https://host.com/index.php?email=a@b.com', 'https://host.com/index.php?email=a@b.com'],
    [
      'multiple URLs in a string',
      'Request to https://user:pass@one.example and https://name:secret@two.example',
      'Request to https://one.example and https://two.example',
    ],
    ['URL without credentials', 'https://host.com/index.php', 'https://host.com/index.php'],
  ])('redacts %s', (_description, input, expected) => {
    expect(redactUrlCredentials(input)).toBe(expected);
  });
});
