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

function getReportMetadata(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
    const idSite = request.configParams.idsite || '1';
    const report = request.configParams.report || 'VisitsSummary.get';

    const [apiModule, apiAction] = report.split('.');

    let result = Api.fetch('API.getMetadata', {
        idSite: `${idSite}`,
        apiModule,
        apiAction,
        period: 'day',
        date: 'today',
    })

    if (Array.isArray(result)) {
        result = result[0];
    }

    return result as Api.ReportMetadata;
}

function getProcessedReport(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
    const idSite = request.configParams.idsite || 1;
    const report = request.configParams.report || 'VisitsSummary.get';

    const [apiModule, apiAction] = report.split('.');

    const period = 'range';
    const date = `${request.dateRange.startDate},${request.dateRange.endDate}`;

    let result = Api.fetch('API.getProcessedReport', {
        idSite: `${idSite}`,
        period,
        date,
        apiModule,
        apiAction,
        format_metrics: '0',
        flat: '1',
    });

    if (Array.isArray(result)) {
        result = result[0];
    }

    return result as Api.ProcessedReport;
}

function isPercent(name: string) {
    return /_rate$/.test(name);
}

function isUniqueCount(name: string) {
    return /uniq_/.test(name);
}

function isAverage(name: string) {
    return /avg_/.test(name);
}

function addMetric(fields: GoogleAppsScript.Data_Studio.Fields, id: string, name: string) {
    console.log('addMetric', id, name);

    const types = cc.FieldType;
    const aggregations = cc.AggregationType;

    let type = types.NUMBER;
    let aggregation = aggregations.SUM;

    if (isPercent(name)) {
        type = types.PERCENT;
    } else if (isUniqueCount(name) || isAverage(name)) {
        aggregation = aggregations.NO_AGGREGATION;
    }

    fields
        .newMetric()
        .setId(id)
        .setName(name)
        .setType(type)
        .setAggregation(aggregation);
}

function addDimension(fields: GoogleAppsScript.Data_Studio.Fields, module: string, dimension: string) {
    console.log('addDimension', module, dimension);

    var types = cc.FieldType;

    fields
        .newDimension()
        .setId('label')
        .setName(dimension)
        .setType(types.TEXT);
}

function getFieldsFromReportMetadata(reportMetadata: Api.ReportMetadata, requestedFields?: string[]) {
    const fields = cc.getFields();

    if (reportMetadata.dimension && (!requestedFields || requestedFields.includes('label'))) {
        addDimension(fields, reportMetadata.module, reportMetadata.dimension);
    }

    [].concat(
        Object.entries(reportMetadata.metrics),
        Object.entries(reportMetadata.processedMetrics),
        // TODO: not supported in poc
        // Object.entries(reportMetadata.metricsGoal),
        // Object.entries(reportMetadata.processedMetricsGoal),
    ).forEach(function (entry) {
        if (!requestedFields || requestedFields.includes(entry[0])) {
            addMetric(fields, entry[0], entry[1]);
        }
    });

    return fields;
}

function getSchema(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
    console.log('getSchema', request); // TODO: better logging + better error reporting

    const reportMetadata = getReportMetadata(request);

    const fields = getFieldsFromReportMetadata(reportMetadata);

    return { schema: fields.build() };
}

function getData(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
    console.log('getData', request);

    const processedReport = getProcessedReport(request);

    const fields = getFieldsFromReportMetadata(processedReport.metadata, request.fields.map(function (r) { return r.name; }));

    const data = processedReport.reportData.map((row) => {
        return {
            values: request.fields.map((requestedField) => (row[requestedField.name] || '').toString()),
        };
    });

    const result = {
        schema: fields.build(),
        rows: data,
        filtersApplied: false
    };

    return result;
}
