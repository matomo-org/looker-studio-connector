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
// TODO: duration_ms will require modifying data

// TODO: test that checks every metric type encountered in demo.matomo.cloud is handled (e2e)
const MATOMO_SEMANTIC_TYPE_TO_LOOKER_MAPPING = {
  'dimension': cc.FieldType.TEXT,
  'binary': cc.FieldType.TEXT,
  'text': cc.FieldType.TEXT,
  'enum': cc.FieldType.TEXT,
  'money': 'currency',
  'byte': cc.FieldType,
  'duration_ms': cc.FieldType,
  'duration_s': cc.FieldType,
  'number': cc.FieldType,
  'float': cc.FieldType,
  'url': cc.FieldType,
  'date': cc.FieldType,
  'time': cc.FieldType,
  'datetime': cc.FieldType,
  'timestamp': cc.FieldType,
  'bool': cc.FieldType,
  'percent': cc.FieldType,
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

    const [apiModule, apiAction] = report.split('.');

    const response = Api.fetch('API.getMetadata', {
        idSite: `${idSite}`,
        apiModule,
        apiAction,
        period: 'day',
        date: 'today',
    });

    if (Array.isArray(response)) {
      return response[0] as Api.ReportMetadata;
    }

    return response as Api.ReportMetadata;
}

function getProcessedReport(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
    const idSite = request.configParams.idsite;
    const report = request.configParams.report;

    const [apiModule, apiAction] = report.split('.');

    // TODO: if no startDate/endDate, throw an error
    // TODO: test ^ in UI

    const period = 'range';
    const date = `${request.dateRange.startDate},${request.dateRange.endDate}`;

    return Api.fetch<Api.ProcessedReport>('API.getProcessedReport', {
        idSite: `${idSite}`,
        period,
        date,
        apiModule,
        apiAction,
        format_metrics: '0',
        flat: '1',
    });
}

function addMetric(fields: GoogleAppsScript.Data_Studio.Fields, id: string, name: string, matomoType: string, siteCurrency: string) {
    const aggregations = cc.AggregationType;

    let type = mapMatomoSemanticTypeToLooker(matomoType, siteCurrency);
    let aggregation = aggregations.NO_AGGREGATION; // TODO: support aggregating all metrics (even processed/computed)

    fields
        .newMetric()
        .setId(id)
        .setName(name)
        .setType(type)
        .setAggregation(aggregation);
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
      ...Object.entries(reportMetadata.metrics || {}),
      ...Object.entries(reportMetadata.processedMetrics || {}),
      // TODO: not supported in poc
      // Object.entries(reportMetadata.metricsGoal),
      // Object.entries(reportMetadata.processedMetricsGoal),
    ].forEach(([id, name]) => {
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
    const siteCurrency = getSiteCurrency(request);

    const fields = getFieldsFromReportMetadata(reportMetadata, siteCurrency);

    return { schema: fields.build() };
}

export function getData(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
    const processedReport = getProcessedReport(request);
    const siteCurrency = getSiteCurrency(request);

    const fields = getFieldsFromReportMetadata(processedReport.metadata, siteCurrency, request.fields?.map((r) => r.name));

    // API methods that return DataTable\Simple instances are just one row, not an array of rows, so we wrap them
    // in an array in this case
    const reportData = Array.isArray(processedReport.reportData) ? processedReport.reportData : [processedReport.reportData];

    const data = reportData.map((row) => {
        return {
            values: request.fields?.map((requestedField) => (row[requestedField.name] || '').toString()) || row,
        };
    });

    const result = {
        schema: fields.build(),
        rows: data,
        filtersApplied: false
    };

    return result;
}
