/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

export default {
  APPSCRIPT_TEST_MATOMO: process.env.APPSCRIPT_TEST_MATOMO || 'https://demo.matomo.cloud/',
  APPSCRIPT_TEST_TOKEN: process.env.APPSCRIPT_TEST_TOKEN || 'anonymous',
  APPSCRIPT_TEST_IDSITE: process.env.APPSCRIPT_TEST_IDSITE || 1,
};
