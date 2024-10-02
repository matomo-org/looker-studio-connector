/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

export default function urlFetchAppMock(errorToThrow: string, throwAsString: boolean = false) {
  let isThrown = false;

  const mockUrlFetchApp = new Proxy(UrlFetchApp, {
    get(target, prop) {
      if (prop === 'fetchAll') {
        return function (...args) {
          if (!isThrown) {
            isThrown = true;

            if (throwAsString) {
              throw errorToThrow;
            } else {
              throw new Error(errorToThrow);
            }
          } else {
            return target[prop].call(this, ...args);
          }
        };
      }
      return target[prop];
    }
  });

  return {
    setUp() {
      const getServices = (new Function('return getServices;'))();
      getServices().UrlFetchApp = mockUrlFetchApp;
    },
    tearDown() {
      const getServices = (new Function('return getServices;'))();
      getServices().UrlFetchApp = UrlFetchApp;
    },
  };
}
