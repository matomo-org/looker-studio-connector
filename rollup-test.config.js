/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

const config = require('./rollup.config');

config.input = 'src-test/index.ts';

module.exports = config;
