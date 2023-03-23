/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

// TODO: document this (here and in README.md)

export function callFunctionInTest(functionName: string, ...params: unknown[]) {
  try { // TODO: note reason for this in docs. OR automate it w/ some kind of wrapper function?
    const fn = eval(functionName);
    const result = fn(...params);
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ message: e.message, stack: e.stack });
  }
}
