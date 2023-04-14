/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import cc from './connector';

const FORUM_URL = 'https://forum.matomo.org/c/looker-studio/25';

/**
 * Throws an error that will be visible to the Looker Studio user. This should be called for
 * errors that are due to simple user errors, eg, not selecting a report or entering the wrong input.
 *
 * @param message
 * @throws Error
 */
export function throwUserError(message: string) {
  cc.newUserError().setText(message).throwException();
}

/**
 * Throws an error that will be visible to the Looker Studio user with some extra text detailing
 * where the user can get support. This should be called for errors that are unexpected and could
 * point to issues in the connector, or for errors that are not easy for the user to resolve themselves.
 *
 * @param message
 * @throws Error
 */
export function throwUnexpectedError(message: string) {
  const wholeMessage = `An error has occurred - if you need help, please reach out in the Forums here: ${FORUM_URL} or `
    + `contact us by email at support@matomo.org. Here is the full error message: ${message}`;
  cc.newUserError().setText(wholeMessage).throwException();
}

/**
 * Determines if an error was thrown via `cc.newUserError()` or a similar method.
 */
export function isLookerStudioError(e: any) {
  return e?.name === 'Exception';
}