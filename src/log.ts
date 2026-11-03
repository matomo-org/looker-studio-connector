/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import env from './env';
import {redactUrlCredentials} from './url';

const isDebug = !!parseInt(env.DEBUG, 10);

export const requestId = Utilities.getUuid();

const configuredHost = PropertiesService.getUserProperties().getProperty('dscc.username');
// Older connector versions persisted credential-bearing URLs. Redact on read as well as
// at the output boundary so existing data sources are protected without reconnecting.
export const currentHost = configuredHost ? redactUrlCredentials(configuredHost) : null;

export function log(...args: unknown[]): void {
  let prefix = `[${requestId}]`;

  if (currentHost) {
    prefix = `${prefix} [${currentHost}]`;
  }

  const safeArgs = args.map((arg) => typeof arg === 'string' ? redactUrlCredentials(arg) : arg);
  console.log(prefix, ...safeArgs);
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
