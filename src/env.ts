/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

const properties = PropertiesService.getScriptProperties();

export default {
  DEBUG: properties.getProperty('DEBUG') || process.env.DEBUG || '0',
  CONFIG_REQUEST_CACHE_TTL_SECS: properties.getProperty('CONFIG_REQUEST_CACHE_TTL_SECS') || process.env.CONFIG_REQUEST_CACHE_TTL_SECS || '300',
  MAX_ROWS_TO_FETCH_PER_REQUEST: properties.getProperty('MAX_ROWS_TO_FETCH_PER_REQUEST') || process.env.MAX_ROWS_TO_FETCH_PER_REQUEST || '100000',
  SCRIPT_RUNTIME_LIMIT: properties.getProperty('SCRIPT_RUNTIME_LIMIT') || process.env.SCRIPT_RUNTIME_LIMIT || '350',
  API_REQUEST_SOURCE_IDENTIFIER: properties.getProperty('API_REQUEST_SOURCE_IDENTIFIER') || process.env.API_REQUEST_SOURCE_IDENTIFIER || 'fromLooker',
};
