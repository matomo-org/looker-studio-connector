/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import env from './env';
import cc, { getScriptElapsedTime } from './connector';

const SCRIPT_RUNTIME_LIMIT = parseInt(env.SCRIPT_RUNTIME_LIMIT) || 0;
const API_REQUEST_RETRY_LIMIT_IN_SECS = parseInt(env.API_REQUEST_RETRY_LIMIT_IN_SECS) || 0;
const MAX_WAIT_BEFORE_RETRY = 32;

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
  dimensions?: string[];
  module: string;
  action: string;
  metrics: Record<string, string>;
  processedMetrics: Record<string, string>;
  metricsGoal?: Record<string, string>;
  processedMetricsGoal?: Record<string, string>;
  category: string;
  name: string;
  metricTypes?: Record<string, string>;
  parameters?: Record<string, string>;
}

type DataTableRow = Record<string, string|false>;

export interface ProcessedReport {
  metadata: ReportMetadata;
  reportData: DataTableRow[];
  reportMetadata?: DataTableRow[];
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
  checkRuntimeLimit?: boolean;
  runtimeLimitAbortMessage?: string;
}

/**
 * Sends multiple API requests simultaneously to the target Matomo.
 *
 * @param requests objects like `{ method: 'API.getSitesWithAtLeastViewAccess', params: {...} }`
 * @param options
 * @return the parsed responses for each request
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

  const allUrls = requests.map(({method, params}) => {
    let url = baseUrl;

    const finalParams = {
      module: 'API',
      method,
      format: 'JSON',
      token_auth: token,
      ...params,
      [env.API_REQUEST_SOURCE_IDENTIFIER]: '1',
    };

    const query = Object.entries(finalParams)
      .filter(([, value]) => typeof value !== 'undefined')
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join('&');

    url += query;

    return url;
  });

  const allUrlsMappedToIndex = Object.fromEntries(allUrls.map((url, i) => [url, i]));

  let responseContents: unknown[] = [];
  let currentWaitBeforeRetryTime = 1000;

  const startTime = Date.now();
  while (Date.now() < startTime + API_REQUEST_RETRY_LIMIT_IN_SECS) {
    if (options.checkRuntimeLimit) {
      // stop requesting if we are close to the apps script time limit and display a warning to the user
      if (SCRIPT_RUNTIME_LIMIT > 0 && getScriptElapsedTime() > SCRIPT_RUNTIME_LIMIT) {
        cc.newUserError().setText(options.runtimeLimitAbortMessage || 'This request is taking too long, aborting.').throwException();
        return;
      }
    }

    const urlsToFetch = Object.keys(allUrlsMappedToIndex);
    const responses = UrlFetchApp.fetchAll(urlsToFetch);
    responses.forEach((r, i) => {
      const code = r.getResponseCode();
      if (code >= 500
        || code === 420
      ) {
        return; // retry
      }

      const urlFetched = urlsToFetch[i];
      const responseIndex = allUrlsMappedToIndex[urlFetched];

      responseContents[responseIndex] = JSON.parse(r.getContentText('UTF-8'));

      delete allUrlsMappedToIndex[urlFetched]; // this request succeeded, so don't make it again
    });

    responseContents = responses.map((r) => JSON.parse(r.getContentText("UTF-8")));

    // if there are still requests to try (because they failed), wait before trying again
    const requestsFailed = !!Object.keys(allUrlsMappedToIndex).length;
    if (requestsFailed) {
      Utilities.sleep(currentWaitBeforeRetryTime);
      currentWaitBeforeRetryTime = Math.min(currentWaitBeforeRetryTime * 2, MAX_WAIT_BEFORE_RETRY);
    }
  }

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
 * Sends a single API request to the target Matomo and returns the result.
 *
 * @param method ie, 'SitesManager.getSitesWithAtLeastViewAccess'
 * @param params extra API request parameters to send
 * @param options
 * @return the parsed response
 */
export function fetch<T = any>(method: string, params: Record<string, string> = {}, options: ApiFetchOptions = {}): T {
  const responses = fetchAll([{ method, params }], options);
  if (responses[0].result === 'error') {
    throw new Error(`API method ${method} failed with: ${responses[0].message}`);
  }
  return responses[0] as T;
}
