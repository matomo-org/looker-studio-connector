/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import cc, { ConnectorParams } from './connector';
import * as Api from './api';
import env from './env';
import { throwUserError, throwUnexpectedError, isLookerStudioError } from './error';

const pastScriptRuntimeLimitErrorMessage = 'It\'s taking too long to get the requested data. This may be a momentary issue with '
  + 'your Matomo, but if it continues to occur for this report, then you may be requesting too much data. In this '
  + 'case, limit the data you are requesting to see it in Looker Studio.';

/*
TODO
Post MVP issues:
- allow accessing multiple matomo instances
*/

// TODO: support old versions of matomo w/o <metricTypes>. display warning.
// TODO: duration_ms will require modifying data. actually, several of these will.

// TODO: test that checks every metric type encountered in demo.matomo.cloud is handled (e2e)
const MATOMO_SEMANTIC_TYPE_TO_LOOKER_MAPPING = {
  'dimension': cc.FieldType.TEXT,
  'binary': cc.FieldType.TEXT,
  'text': cc.FieldType.TEXT,
  'enum': cc.FieldType.TEXT,
  'money': 'currency',
  'byte': cc.FieldType.NUMBER,
  'duration_ms': cc.FieldType.DURATION,
  'duration_s': cc.FieldType.DURATION,
  'number': cc.FieldType.NUMBER,
  'float': cc.FieldType.NUMBER,
  'url': cc.FieldType.URL,
  'date': cc.FieldType.YEAR_MONTH_DAY,
  'time': cc.FieldType.TEXT,
  'datetime': cc.FieldType.YEAR_MONTH_DAY_SECOND,
  'timestamp': cc.FieldType.YEAR_MONTH_DAY_SECOND,
  'bool': cc.FieldType.BOOLEAN,
  'percent': cc.FieldType.PERCENT,
};

// exported for tests
export function getMatomoSemanticTypeToLookerMapping() {
  return MATOMO_SEMANTIC_TYPE_TO_LOOKER_MAPPING;
}

function mapMatomoSemanticTypeToLooker(matomoType: string, siteCurrencyCode: string) {
  let mapped = MATOMO_SEMANTIC_TYPE_TO_LOOKER_MAPPING[matomoType] || cc.FieldType.TEXT;
  if (mapped === 'currency') {
    // NOTE: not all currencies supported in Matomo are supported by looker studio
    mapped = cc.FieldType[`CURRENCY_${siteCurrencyCode.toUpperCase()}`] || cc.FieldType.NUMBER;
  }
  return mapped;
}

function getSiteCurrency(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  const idSite = request.configParams.idsite;

  const response = Api.fetch<Api.Site>('SitesManager.getSiteFromId', { idSite: `${idSite}` });

  return response.currency;
}

function getReportMetadata(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  const idSite = request.configParams.idsite;
  const report = request.configParams.report;

  const reportParams = JSON.parse(report) as Record<string, string>;

  let apiParameters: Record<string, string> = {};
  Object.entries(reportParams).forEach(([k, v]) => {
    if (k === 'apiModule' || k === 'apiAction') {
      return;
    }

    apiParameters[`apiParameters[${k}]`] = v;
  });

  const response = Api.fetch('API.getMetadata', {
    apiModule: reportParams.apiModule,
    apiAction: reportParams.apiAction,
    ...apiParameters,
    idSite: `${idSite}`,
    period: 'day',
    date: 'today',
  });

  let result = response as Api.ReportMetadata;
  if (Array.isArray(response)) {
    result = response[0] as Api.ReportMetadata;
  }

  if ((result as any).value === false) {
    return null;
  }

  return result;
}

// TODO: issue w/ nb_uniq_visitors: it only displays when requesting a single day, but we can't make the getSchema() result differ
//       based on the date range.
function getProcessedReport(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  const idSite = request.configParams.idsite;
  const report = request.configParams.report;
  const filter_limit = parseInt(request.configParams.filter_limit || '-1', 10);

  const rowsToFetchAtATime = parseInt(env.MAX_ROWS_TO_FETCH_PER_REQUEST, 10) || 100000;

  const reportParams = JSON.parse(report);

  // some API methods (like Actions.getPageUrlsFollowingSiteSearch) have trouble when using a range for a single day,
  // so we make sure to do a check for this case
  const isSingleDay = request.dateRange.startDate === request.dateRange.endDate;
  const period = isSingleDay ? 'day' : 'range';
  const date = isSingleDay ? request.dateRange.startDate : `${request.dateRange.startDate},${request.dateRange.endDate}`;

  // request report data one large chunk at a time to make sure we don't hit the 50mb HTTP response size limit
  // for apps scripts
  let response: Api.ProcessedReport|null = null;
  while (!response || response.reportData.length < filter_limit) {
    const limitToUse = filter_limit < 0 || filter_limit >= rowsToFetchAtATime ? rowsToFetchAtATime : filter_limit;
    const partialResponse = Api.fetch<Api.ProcessedReport>('API.getProcessedReport', {
      ...reportParams,
      idSite: `${idSite}`,
      period,
      date,
      format_metrics: '0', // TODO: doesn't appear to work in every case (eg, API.get still returns % formatted values)
      flat: '1',
      filter_limit: `${limitToUse}`,
      filter_offset: `${response?.reportData.length || 0}`,
    }, {
      checkRuntimeLimit: true,
      runtimeLimitAbortMessage: pastScriptRuntimeLimitErrorMessage,
    });

    if ((partialResponse as any).value === false) {
      break; // nothing returned by request
    }

    if (!response) {
      response = partialResponse;
      if (!response.reportData) { // sanity check
        response.reportData = [];
      }
    } else {
      response.reportData.push(...partialResponse.reportData);
    }

    if (partialResponse.reportData.length < limitToUse) {
      break; // less rows than limit returned, so no more data
    }
  }

  return response;
}

function addMetric(fields: GoogleAppsScript.Data_Studio.Fields, id: string, name: string, matomoType: string, siteCurrency: string) {
  let type = mapMatomoSemanticTypeToLooker(matomoType, siteCurrency);

  fields
    .newMetric()
    .setId(id)
    .setName(name)
    .setType(type)
    // TODO: support aggregating all metrics (even processed/computed)
    .setIsReaggregatable(false);
}

function addDimension(fields: GoogleAppsScript.Data_Studio.Fields, id: string, dimension: string) {
  fields
    .newDimension()
    .setId(id)
    .setName(dimension)
    .setType(cc.FieldType.TEXT); // TODO: support mapping dimension type (might need to put it in the API)
}

// TODO: will all sites have a currency? (they won't, we should check and provide a warning when configuring)

function getFieldsFromReportMetadata(reportMetadata: Api.ReportMetadata, siteCurrency: string, requestedFields?: string[]) {
  const fields = cc.getFields();

  const allMetrics = {
    ...reportMetadata.metrics,
    ...reportMetadata.processedMetrics,
    // TODO: not supported in poc
    // Object.entries(reportMetadata.metricsGoal),
    // Object.entries(reportMetadata.processedMetricsGoal),
  };

  if (!requestedFields?.length) {
    if (reportMetadata.dimensions) {
      Object.entries(reportMetadata.dimensions).forEach(([id, name]) => {
        addDimension(fields, id, name);
      });
    } else if (reportMetadata.dimension) {
      addDimension(fields, 'label', reportMetadata.dimension);
    }
  }

  (requestedFields || Object.keys(allMetrics)).forEach((metricId) => {
    if (fields.getFieldById(metricId)) {
      return;
    }

    // TODO test for when label is not first in requested field
    if (metricId === 'label') {
      if (reportMetadata.dimension) {
        addDimension(fields, 'label', reportMetadata.dimension);
      }
      return;
    }

    if (reportMetadata.dimensions?.[metricId]) {
      addDimension(fields, metricId, reportMetadata.dimensions[metricId]);
      return;
    }

    if (allMetrics[metricId]) {
      const matomoType = reportMetadata.metricTypes?.[metricId] || 'text';
      addMetric(fields, metricId, allMetrics[metricId], matomoType, siteCurrency);
    }
  });

  return fields;
}

// TODO: better logging

export function getSchema(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  try {
    // TODO: automated tests for these
    if (!request.configParams.report) {
      throwUserError('No report was selected when configuring the connector. Please go back and select one.');
    }

    if (request.configParams.filter_limit
      && Number.isNaN(parseInt(request.configParams.filter_limit, 10))
    ) {
      throwUserError(`The "Default Row Limit" entered (${request.configParams.filter_limit}) is not valid. Please enter a valid integer or leave it empty.`);
    }

    const reportMetadata = getReportMetadata(request);
    if (!reportMetadata) {
      const reportParams = JSON.parse(request.configParams.report);
      throwUnexpectedError(`The "${reportParams.apiModule}.${reportParams.apiAction}" report cannot be found.`);
    }

    const siteCurrency = getSiteCurrency(request);

    const fields = getFieldsFromReportMetadata(reportMetadata, siteCurrency);

    return { schema: fields.build() };
  } catch (e) {
    if (isLookerStudioError(e)) {
      throw e;
    }

    console.log(`Unexpected error: ${e.stack || e.message}`);
    throwUnexpectedError(e.message);
  }
}

export function getData(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  try {
    if (!request.dateRange
      || !request.dateRange.startDate
      || !request.dateRange.endDate
    ) {
      throwUserError('A date range must be supplied.');
    }

    const processedReport = getProcessedReport(request);
    if (!processedReport) {
      const reportParams = JSON.parse(request.configParams.report);
      throwUnexpectedError(`The "${reportParams.apiModule}.${reportParams.apiAction}" report cannot be found.`);
    }

    const siteCurrency = getSiteCurrency(request);

    const fields = getFieldsFromReportMetadata(processedReport.metadata, siteCurrency, request.fields?.map((r) => r.name));

    // API methods that return DataTable\Simple instances are just one row, not an array of rows, so we wrap them
    // in an array in this case
    const reportData = Array.isArray(processedReport.reportData) ? processedReport.reportData : [processedReport.reportData];

    let requestedFields = request.fields?.filter(({ name }) => !!fields.getFieldById(name));
    if (!requestedFields) {
      requestedFields = fields.asArray().map((f) => ({ name: f.getId() }));
    }

    const data = reportData.map((row, i) => {
      const metadataRow = processedReport?.reportMetadata[i];

      // TODO: test requested fields when there are multiple dimensions in flattened report
      const fieldValues = requestedFields
        .map(({ name }) => {
          if (typeof row[name] !== 'undefined') {
            const value = row[name];

            if (value === false) { // edge case that can happen in some report output
              const type = fields.getFieldById(name).getType();
              if (type === cc.FieldType.TEXT) {
                return '';
              }

              return '0';
            }

            // NOTE: the value MUST be a string, even if it's declared a number or something else. Looker studio will
            // fumble sometimes when it's not a string (for example, when the metric is marked as a duration) and
            // fail to display the data.
            return `${value}`;
          }

          if (typeof metadataRow?.[name] !== 'undefined') {
            return `${metadataRow[name]}`;
          }

          return '';
        });

      return {
        values: fieldValues,
      };
    });

    const result = {
      schema: fields.build(),
      rows: data,
      filtersApplied: false,
    };
    return result;
  } catch (e) {
    if (isLookerStudioError(e)) {
      throw e;
    }

    console.log(`Unexpected error: ${e.stack || e.message}`);
    throwUnexpectedError(e.message);
  }
}
