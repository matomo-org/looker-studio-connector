/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import env from './env';

const isDebug = !!parseInt(env.DEBUG, 10);

export const requestId = Utilities.getUuid();

export function log(...args: unknown[]): void {
  console.log(`[${requestId}]`, ...args);
}

export function debugLog(...args: unknown[]): void {
  if (!isDebug) {
    return;
  }

  log(...args);
}