/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import env from './env';

const isDebug = !!parseInt(env.DEBUG, 10);

export const requestId = Utilities.getUuid();

export const currentHost = PropertiesService.getUserProperties().getProperty('dscc.username');

export function log(...args: unknown[]): void {
  let prefix = `[${requestId}]`;

  if (currentHost) {
    prefix = `${prefix} [${currentHost}]`;
  }

  console.log(prefix, ...args);
}

export function logError(error: Error, callerId?: string): void {
  const { stack } = error;

  log(`Unexpected error${callerId ? ` in ${callerId}` : ''}: ${stack}`);
}

export function debugLog(...args: unknown[]): void {
  if (!isDebug) {
    return;
  }

  log(...args);
}
