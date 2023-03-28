/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { ConnectorParams } from './connector';
import * as Api from './api';
import cc from './connector';

// TODO: make sure UX is good when exceptions Matomo requests errors
// TODO: use pagination to surpass 50mb request limit
// TODO: detect time limit issue and cut out w/ warning in case users still requests too much data
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
    mapped = cc.FieldType[`CURRENCY_${siteCurrencyCode.toUpperCase()}`];
  }
  return mapped;
}

// TODO: this result can be cached as well
function getSiteCurrency(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  const idSite = request.configParams.idsite;

  const response = Api.fetch<Api.Site>('SitesManager.getSiteFromId', {
    idSite: `${idSite}`,
  });

  // TODO: make sure all currencies from matomo can be translated to looker studio connector
  return response.currency;
}

// TODO: report metadata can be cached
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

function getProcessedReport(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  const idSite = request.configParams.idsite;
  const report = request.configParams.report;
  const filter_limit = request.configParams.filter_limit || '-1';

  const reportParams = JSON.parse(report);

  const period = 'range';
  const date = `${request.dateRange.startDate},${request.dateRange.endDate}`;

  const response = Api.fetch<Api.ProcessedReport>('API.getProcessedReport', {
    ...reportParams,
    idSite: `${idSite}`,
    period,
    date,
    format_metrics: '0',
    flat: '1',
    filter_limit,
  });

  if ((response as any).value === false) {
    return null;
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

function addDimension(fields: GoogleAppsScript.Data_Studio.Fields, module: string, dimension: string) {
  fields
    .newDimension()
    .setId('label')
    .setName(dimension)
    .setType(cc.FieldType.TEXT); // TODO: support mapping dimension type (might need to put it in the API)
}

// TODO: will all sites have a currency?

function getFieldsFromReportMetadata(reportMetadata: Api.ReportMetadata, siteCurrency: string, requestedFields?: string[]) {
  const fields = cc.getFields();

  if (reportMetadata.dimension && (!requestedFields || requestedFields.includes('label'))) {
    addDimension(fields, reportMetadata.module, reportMetadata.dimension);
  }

  [
    ...Object.entries({
      ...reportMetadata.metrics,
      ...reportMetadata.processedMetrics,
    }),
    // TODO: not supported in poc
    // Object.entries(reportMetadata.metricsGoal),
    // Object.entries(reportMetadata.processedMetricsGoal),
  ].forEach(([id, name]) => {
    if (id === 'label') { // metrics array can sometimes contain a 'label' entry, but we reserve that for the dimension
      return;
    }

    if (!requestedFields || requestedFields.includes(id)) {
      const matomoType = reportMetadata.metricTypes?.[id] || 'text';
      addMetric(fields, id, name, matomoType, siteCurrency);
    }
  });

  return fields;
}

// TODO: better logging + better error reporting

export function getSchema(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  const reportMetadata = getReportMetadata(request);
  if (!reportMetadata) {
    const reportParams = JSON.parse(request.configParams.report);
    cc.newUserError().setText(`The "${reportParams.apiModule}.${reportParams.apiAction}" report cannot be found.`).throwException();
  }

  const siteCurrency = getSiteCurrency(request);

  const fields = getFieldsFromReportMetadata(reportMetadata, siteCurrency);

  return { schema: fields.build() };
}

export function getData(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  if (!request.dateRange
    || !request.dateRange.startDate
    || !request.dateRange.endDate
  ) {
    cc.newUserError().setText('A date range must be supplied.').throwException();
  }

  const processedReport = getProcessedReport(request);
  if (!processedReport) {
    const reportParams = JSON.parse(request.configParams.report);
    cc.newUserError().setText(`The "${reportParams.apiModule}.${reportParams.apiAction}" report cannot be found.`).throwException();
  }

  const siteCurrency = getSiteCurrency(request);

  const fields = getFieldsFromReportMetadata(processedReport.metadata, siteCurrency, request.fields?.map((r) => r.name));

  // API methods that return DataTable\Simple instances are just one row, not an array of rows, so we wrap them
  // in an array in this case
  const reportData = Array.isArray(processedReport.reportData) ? processedReport.reportData : [processedReport.reportData];

  const data = reportData.map((row) => {
    const filteredFields = request.fields
      ?.filter((requestedField) => typeof row[requestedField.name] !== 'undefined')
      .map((requestedField) => (row[requestedField.name] || '').toString());

    return {
      values: filteredFields || row,
    };
  });

  const result = {
    schema: fields.build(),
    rows: data,
    filtersApplied: false
  };

  return result;
}
