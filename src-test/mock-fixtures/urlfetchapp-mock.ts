/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

export default function urlFetchAppMock(errorToThrow: string, throwAsString: boolean = false) {
  const previousFetchAll = UrlFetchApp.fetchAll;
  let isThrown = false;

  return {
    setUp() {
      UrlFetchApp.fetchAll = function (...args) {
        if (!isThrown) {
          isThrown = true;

          if (throwAsString) {
            throw errorToThrow;
          } else {
            throw new Error(errorToThrow);
          }
        } else {
          return previousFetchAll.call(this, ...args);
        }
      };
    },
    tearDown() {
      UrlFetchApp.fetchAll = previousFetchAll;
    },
  };
}
