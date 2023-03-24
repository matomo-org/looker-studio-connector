/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

export interface Site {
  idsite: string|number;
  name: string;
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

/**
 * TODO
 *
 * @param requests
 * @param options
 */
export function fetchAll(requests: MatomoRequestParams[], options: Record<string, string|number|boolean> = {}) {
  const userProperties = PropertiesService.getUserProperties();
  const instanceUrl = options.instanceUrl as string || userProperties.getProperty('dscc.username');
  const token = options.token as string || userProperties.getProperty('dscc.token');

  let baseUrl = instanceUrl;
  if (!/\/$/.test(baseUrl)) {
    baseUrl += '/';
  }
  baseUrl += 'index.php?';

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
  return responseContents;
}

/**
 * TODO
 *
 * @param method
 * @param params
 * @param options
 */
export function fetch<T = any>(method: string, params: Record<string, string> = {}, options: Record<string, string|number|boolean> = {}): T {
  const responses = fetchAll([{ method, params }], options);
  if (responses[0].error) {
    throw new Error(`API method ${method} failed with: ${responses[0].message}`);
  }
  return responses[0] as T;
}
