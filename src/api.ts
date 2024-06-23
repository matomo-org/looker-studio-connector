/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import env from './env';
import { getScriptElapsedTime } from './connector';
import { throwUnexpectedError } from './error';
import URLFetchRequest = GoogleAppsScript.URL_Fetch.URLFetchRequest;
import { debugLog, log } from './log';

const SCRIPT_RUNTIME_LIMIT = parseInt(env.SCRIPT_RUNTIME_LIMIT) || 0;
const API_REQUEST_RETRY_LIMIT_IN_SECS = parseInt(env.API_REQUEST_RETRY_LIMIT_IN_SECS) || 0;
const MAX_WAIT_BEFORE_RETRY = 32;

let API_REQUEST_EXTRA_HEADERS = {};
try {
  API_REQUEST_EXTRA_HEADERS = JSON.parse(env.API_REQUEST_EXTRA_HEADERS);
} catch (e) {
  // ignore
}

export interface Site {
  idsite: string|number;
  name: string;
  currency: string;
}

export interface Language {
  code: string;
  name: string;
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
  metricTypesGoal?: Record<string, string>;
  parameters?: Record<string, string>;
  metricAggregationTypes?: Record<string, string>;
  metricAggregationTypesGoal?: Record<string, string>;
}

export interface Goal {
  idsite: string|number;
  idgoal: string|number;
  name: string;
}

export type DataTableRow = Record<string, string|number|false>;

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
  throwOnFailedRequest?: boolean;
}

export function extractBasicAuthFromUrl(url: string): { authHeaders: Record<string, string>, urlWithoutAuth: string } {
  const authHeaders: Record<string, string> = {};

  const matches = /^(https?):\/\/([^:]+)(?::([^@]+)?)?@(.+)/.exec(url);
  if (matches) {
    const [, protocol, httpUsername, httpPassword, restOfUrl] = matches;
    if (httpUsername) {
      const authStr = `${decodeURIComponent(httpUsername || '')}:${decodeURIComponent(httpPassword || '')}`;
      authHeaders.Authorization = `Basic ${Utilities.base64Encode(authStr)}`;
      url = `${protocol}://${restOfUrl}`;
    }
  }

  return { authHeaders, urlWithoutAuth: url };
}

/**
 * Sends multiple API requests simultaneously to the target Matomo.
 *
 * @param requests objects like `{ method: 'API.getSitesWithAtLeastViewAccess', params: {...} }`
 * @param options
 * @return the parsed responses for each request
 */
export function fetchAll(requests: MatomoRequestParams[], options: ApiFetchOptions = {}): any[] {
  // TODO: this method could probably be cleaned up
  const cache = CacheService.getUserCache();
  if (options.cacheKey && options.cacheTtl > 0) {
    const cacheEntry = cache.get(options.cacheKey);
    if (typeof cacheEntry !== 'undefined' && cacheEntry !== null) {
      try {
        return JSON.parse(cacheEntry);
      } catch (e) {
        log(`unexpected: failed to parse cache data for ${options.cacheKey}`);
      }
    }
  }

  const userProperties = PropertiesService.getUserProperties();
  const instanceUrl = options.instanceUrl as string || userProperties.getProperty('dscc.username');
  const token = options.token as string || userProperties.getProperty('dscc.token');

  let baseUrl = instanceUrl;
  if (!baseUrl) {
    throw new Error('Unexpected: no matomo base URL configured');
  }

  baseUrl = baseUrl.replace(/\/+(index\.php\??)?$/, '');
  baseUrl += '/index.php?';

  const { authHeaders, urlWithoutAuth } = extractBasicAuthFromUrl(baseUrl);
  baseUrl = urlWithoutAuth;

  const allUrls = requests.map(({method, params}) => {
    const finalParams = {
      module: 'API',
      method,
      format: 'JSON',
      ...params,
      [env.API_REQUEST_SOURCE_IDENTIFIER]: '1',
    };

    const query = Object.entries(finalParams)
      .filter(([, value]) => typeof value !== 'undefined')
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join('&');

    return query;
  });

  debugLog('making requests to matomo:', allUrls);

  const allUrlsMappedToIndex = Object.fromEntries(allUrls.map((url, i) => [url, i]));

  let responseContents: any[] = [];
  let currentWaitBeforeRetryTime = 1000;

  const startTime = Date.now();
  while (Object.keys(allUrlsMappedToIndex).length && Date.now() < startTime + API_REQUEST_RETRY_LIMIT_IN_SECS * 1000) {
    if (options.checkRuntimeLimit) {
      // stop requesting if we are close to the apps script time limit and display a warning to the user
      if (SCRIPT_RUNTIME_LIMIT > 0 && getScriptElapsedTime() > SCRIPT_RUNTIME_LIMIT * 1000) {
        const allRequests = Object.keys(allUrlsMappedToIndex).join(', ');
        let message = options.runtimeLimitAbortMessage || 'This request is taking too long, aborting.';
        message = `${message} (Requests being sent: ${allRequests}).`;
        throwUnexpectedError(message);
        return;
      }
    }

    let countOfFailedRequests = 0;

    const urlsToFetch = Object.keys(allUrlsMappedToIndex).map((u) => (<URLFetchRequest>{
      url: baseUrl,
      headers: { ...API_REQUEST_EXTRA_HEADERS, ...authHeaders },
      method: 'post',
      payload: u + '&token_auth=' + token,
      muteHttpExceptions: true,
      wholeUrl: u, // used to link urlsToFetch with allUrlsMappedToIndex
    }));

    const responses = UrlFetchApp.fetchAll(urlsToFetch);

    responses.forEach((r, i) => {
      const urlFetched = (urlsToFetch[i] as any).wholeUrl;
      const responseIndex = allUrlsMappedToIndex[urlFetched];

      const code = r.getResponseCode();

      if (code < 200 || code >= 400) {
        log(`Matomo API request failed with code ${code}.`);

        if (
          (code >= 502 && code <= 504)
          || code === 420
        ) {
          countOfFailedRequests += 1;
          return; // retry
        }

        responseContents[responseIndex] = {
          result: 'error',
          message: `Matomo server failed with code ${code}. Truncated response: ${r.getContentText('UTF-8').substring(0, 100)}`,
        };
      } else {
        // save the response even if it's an error so we can get the server-side error message if needed
        responseContents[responseIndex] = r.getContentText('UTF-8') || '{}';
        responseContents[responseIndex] = JSON.parse(responseContents[responseIndex] as string);

        if (responseContents[responseIndex].result === 'error'
          && !/Requested report.*not found in the list of available reports/.test(responseContents[responseIndex].message)
          && !/does not support multiple/.test(responseContents[responseIndex].message) // for VisitTime.getByDayOfWeek
          && !/The plugin \w+ is not enabled/.test(responseContents[responseIndex].message)
        ) {
          log(`Matomo returned an error for request ${urlFetched}: ${responseContents[responseIndex].message}`);

          countOfFailedRequests += 1;
          return; // retry
        }
      }

      // this request succeeded or failed for a non-random reason, so don't make it again
      delete allUrlsMappedToIndex[urlFetched];
    });

    // if there are still requests to try (because they failed), wait before trying again
    const remainingRequestCount = Object.keys(allUrlsMappedToIndex).length;
    const requestsFailed = !!remainingRequestCount;
    if (requestsFailed) {
      log(`${countOfFailedRequests} request(s) failed, retrying after ${currentWaitBeforeRetryTime / 1000} seconds.`);

      Utilities.sleep(currentWaitBeforeRetryTime);
      currentWaitBeforeRetryTime = Math.min(currentWaitBeforeRetryTime * 2, MAX_WAIT_BEFORE_RETRY * 1000);
    }
  }

  if (options.throwOnFailedRequest) {
    const errorResponses = responseContents
      .map((r, i) => ({ ...r, index: i }))
      .filter((r) => r.result === 'error');

    if (errorResponses.length === 1) {
      const { method, params } = requests[errorResponses[0].index];
      throwUnexpectedError(`API method ${method} failed with: "${errorResponses[0].message}". (params = ${JSON.stringify(params)})`);
    } else if (errorResponses.length > 1) {
      throwUnexpectedError(`${errorResponses.length} API methods failed.`);
    }
  }

  if (options.cacheKey && options.cacheTtl > 0) {
    try {
      cache.put(options.cacheKey, JSON.stringify(responseContents), options.cacheTtl);
    } catch (e) {
      log(`unexpected: failed to save cache data for ${options.cacheKey}`);
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
  const responses = fetchAll([{ method, params }], { ...options, throwOnFailedRequest: true });
  return responses[0] as T;
}
