/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

const properties = PropertiesService.getScriptProperties();

const env = typeof process === 'undefined' ? null : process.env;

export default <Record<string, string>>{
  DEBUG: properties.getProperty('DEBUG') || env?.DEBUG || '0',
  CONFIG_REQUEST_CACHE_TTL_SECS: properties.getProperty('CONFIG_REQUEST_CACHE_TTL_SECS') || env?.CONFIG_REQUEST_CACHE_TTL_SECS || '60',
  MAX_ROWS_TO_FETCH_PER_REQUEST: properties.getProperty('MAX_ROWS_TO_FETCH_PER_REQUEST') || env?.MAX_ROWS_TO_FETCH_PER_REQUEST || '50000',
  SCRIPT_RUNTIME_LIMIT: properties.getProperty('SCRIPT_RUNTIME_LIMIT') || env?.SCRIPT_RUNTIME_LIMIT || '350',
  API_REQUEST_SOURCE_IDENTIFIER: properties.getProperty('API_REQUEST_SOURCE_IDENTIFIER') || env?.API_REQUEST_SOURCE_IDENTIFIER || 'fromLooker',
  API_REQUEST_RETRY_LIMIT_IN_SECS: properties.getProperty('API_REQUEST_RETRY_LIMIT_IN_SECS') || env?.API_REQUEST_RETRY_LIMIT_IN_SECS || '120',
  API_REQUEST_EXTRA_HEADERS: properties.getProperty('API_REQUEST_EXTRA_HEADERS') || env?.API_REQUEST_EXTRA_HEADERS || '{}',
};
