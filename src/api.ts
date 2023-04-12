/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

// TODO: requests should be marked somehow so it's possible to see what kind of load use of looker adds to a matomo instance

export interface Site {
  idsite: string|number;
  name: string;
  currency: string;
}

export interface StoredSegment {
  name: string;
  definition: string;
}

export interface ReportMetadata {
  dimension: string;
  module: string;
  action: string;
  metrics: Record<string, string>;
  processedMetrics: Record<string, string>;
  category: string;
  name: string;
  metricTypes?: Record<string, string>;
  parameters?: Record<string, string>;
}

type DataTableRow = Record<string, string>;

export interface ProcessedReport {
  metadata: ReportMetadata;
  reportData: DataTableRow[];
}

interface MatomoRequestParams {
  method: string,
  params?: Record<string, string>,
}

interface ApiFetchOptions {
  instanceUrl?: string;
  token?: string;
  cacheKey?: string;
  cacheTtl?: number;
}

/**
 * TODO
 *
 * @param requests
 * @param options
 */
export function fetchAll(requests: MatomoRequestParams[], options: ApiFetchOptions = {}) {
  const cache = CacheService.getUserCache();
  if (options.cacheKey && options.cacheTtl > 0) {
    const cacheEntry = cache.get(options.cacheKey);
    if (typeof cacheEntry !== 'undefined' && cacheEntry !== null) {
      try {
        return JSON.parse(cacheEntry);
      } catch (e) {
        // ignore
        // TODO: debug log or rethrow during development
      }
    }
  }

  const userProperties = PropertiesService.getUserProperties();
  const instanceUrl = options.instanceUrl as string || userProperties.getProperty('dscc.username');
  const token = options.token as string || userProperties.getProperty('dscc.token');

  let baseUrl = instanceUrl;
  baseUrl = baseUrl.replace(/[/]+(index\.php\??)?$/, '');
  baseUrl += '/index.php?';

  const allUrls = requests.map(({ method, params }) => {
    let url = baseUrl;

    const finalParams = {
      module: 'API',
      method,
      format: 'JSON',
      token_auth: token,
      ...params,
    };

    const query = Object.entries(finalParams)
      .filter(([, value]) => typeof value !== 'undefined')
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join('&');

    url += query;

    return url;
  })

  const responses = UrlFetchApp.fetchAll(allUrls);
  const responseContents = responses.map((r) => JSON.parse(r.getContentText("UTF-8")));

  if (options.cacheKey && options.cacheTtl > 0) {
    try {
      cache.put(options.cacheKey, JSON.stringify(responseContents), options.cacheTtl);
    } catch (e) {
      // TODO rethrow during development
    }
  }

  return responseContents;
}

/**
 * TODO
 *
 * @param method
 * @param params
 * @param options
 */
export function fetch<T = any>(method: string, params: Record<string, string> = {}, options: ApiFetchOptions = {}): T {
  const responses = fetchAll([{ method, params }], options);
  if (responses[0].result === 'error') {
    throw new Error(`API method ${method} failed with: ${responses[0].message}`);
  }
  return responses[0] as T;
}
