/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import cc, { ConnectorParams } from '../connector';
import * as Api from '../api';
import {
  DATE_DIMENSIONS,
  mapMatomoAggregationTypeToLooker,
  mapMatomoSemanticTypeToLooker,
} from './data-types';
import AggregationType = GoogleAppsScript.Data_Studio.AggregationType;
import { mapMatomoFormulaToLooker } from './formula';

export function getReportMetadataAndGoalsAndCurrency(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  const idSite = request.configParams.idsite;
  const report = request.configParams.report;
  const segment = request.configParams.segment || '';

  const reportParams = JSON.parse(report) as Record<string, string>;

  let apiParameters: Record<string, string> = {};
  Object.entries(reportParams).forEach(([k, v]) => {
    if (k === 'apiModule' || k === 'apiAction') {
      return;
    }

    apiParameters[`apiParameters[${k}]`] = v;
  });

  const response = Api.fetchAll(
    [
      {
        method: 'API.getMetadata',
        params: {
          apiModule: reportParams.apiModule,
          apiAction: reportParams.apiAction,
          ...apiParameters,
          idSite: `${idSite}`,
          period: 'day',
          date: 'today',
          language: request.configParams.language || Session.getActiveUserLocale(),
          segment,
        },
      },
      {
        method: 'Goals.getGoals',
        params: {
          idSite: `${idSite}`,
          period: 'day',
          date: 'today',
        },
      },
      {
        method: 'SitesManager.getSiteFromId',
        params: { idSite: `${idSite}` },
      },
    ],
    { throwOnFailedRequest: true }
  );

  let result = response[0] as Api.ReportMetadata;
  if (Array.isArray(result)) {
    result = result[0] as Api.ReportMetadata;
  }

  if ((result as any).value === false) {
    result = null;
  }

  const goals = response[1] as Record<string, Api.Goal>;

  const siteCurrency = (response[2] as Api.Site).currency;

  return { reportMetadata: result, goals, siteCurrency };
}

function metricsForEachGoal(metrics: Record<string, string>, goals: Record<string, Api.Goal>) {
  const perGoalMetrics = {};
  Object.values(goals).forEach((goal) => {
    Object.entries(metrics).forEach(([id, name]) => {
      const goalMetricId = `goal_${goal.idgoal}_${id}`;
      const goalMetricName = `"${goal.name}" ${name}`;
      perGoalMetrics[goalMetricId] = goalMetricName;
    });
  });
  return perGoalMetrics;
}

function addMetric(
  fields: GoogleAppsScript.Data_Studio.Fields,
  id: string,
  name: string,
  matomoType: string,
  siteCurrency: string,
  reaggregation?: string,
  lookerFormula?: string,
) {
  let type = mapMatomoSemanticTypeToLooker(matomoType, siteCurrency);
  let aggregationType = mapMatomoAggregationTypeToLooker(reaggregation);

  const field = fields
    .newMetric()
    .setId(id)
    .setName(name)
    .setType(type);

  if (lookerFormula) {
    field
      .setFormula(lookerFormula)
      .setAggregation(AggregationType.AUTO);
  } else if (aggregationType) {
    field.setAggregation(aggregationType);
  } else {
    field.setIsReaggregatable(false);
  }
}

function addDimension(fields: GoogleAppsScript.Data_Studio.Fields, id: string, dimension: string) {
  fields
    .newDimension()
    .setId(id)
    .setName(dimension)
    .setType(cc.FieldType.TEXT);
}

function addDateDimensions(
  fields: GoogleAppsScript.Data_Studio.Fields,
  includeOnly: string[] = Object.keys(DATE_DIMENSIONS),
) {
  includeOnly.forEach((id) => {
    if (!DATE_DIMENSIONS[id]) {
      return;
    }

    fields
      .newDimension()
      .setId(id)
      .setName(DATE_DIMENSIONS[id].name)
      .setType(DATE_DIMENSIONS[id].type);
  });
}

function addTemporaryMetric(
  fields: GoogleAppsScript.Data_Studio.Fields,
  metricId: string,
  matomoType: string,
  siteCurrency: string,
  aggregationType?: string,
) {
  const field = fields
    .newMetric()
    .setId(metricId)
    .setName(metricId)
    .setIsHidden(true)
    .setType(mapMatomoSemanticTypeToLooker(matomoType, siteCurrency));

  const tempFieldAggregation = mapMatomoAggregationTypeToLooker(aggregationType);
  if (tempFieldAggregation) {
    field.setAggregation(tempFieldAggregation);
  }
}

export function getFieldsFromReportMetadata(
  reportMetadata: Api.ReportMetadata,
  goals: Record<string, Api.Goal>,
  siteCurrency: string,
  requestedFields?: string[],
) {
  const fields = cc.getFields();

  let allMetrics = { ...reportMetadata.metrics };
  let allProcessedMetrics = { ...reportMetadata.processedMetrics };

  if (reportMetadata.metricsGoal) {
    allMetrics = { ...allMetrics, ...metricsForEachGoal(reportMetadata.metricsGoal, goals) };
  }

  if (reportMetadata.processedMetricsGoal) {
    allProcessedMetrics = { ...allProcessedMetrics, ...metricsForEachGoal(reportMetadata.processedMetricsGoal, goals) };
  }

  if (reportMetadata.metricsGoal || reportMetadata.processedMetricsGoal) {
    // add goal specific conversion_rate if not present in metadata, but other goal metrics are
    // (in 4.x-dev, this is removed in the API despite the data being available)
    if (!reportMetadata.metricsGoal?.conversion_rate && !reportMetadata.processedMetricsGoal?.conversion_rate) {
      allProcessedMetrics = { ...allProcessedMetrics, ...metricsForEachGoal({ 'conversion_rate': 'Conversion Rate' }, goals) };
    }

    // pre 5.1.0, the overall conversions and revenue sum metrics were not present in metadata output,
    // but the data exists in the actual API output
    if (reportMetadata.module !== 'Actions') {
      if (!reportMetadata.metrics?.conversion) {
        allMetrics['nb_conversions'] = 'Conversions';
        reportMetadata.metricTypes['nb_conversions'] = 'number';
      }
      if (!reportMetadata.metrics?.revenue) {
        allMetrics['revenue'] = 'Revenue';
        reportMetadata.metricTypes['revenue'] = 'money';
      }
    }
  }

  if (!requestedFields?.length) {
    if (reportMetadata.dimensions) {
      Object.entries(reportMetadata.dimensions).forEach(([id, name]) => {
        addDimension(fields, id, name);
      });
    } else if (reportMetadata.dimension) {
      addDimension(fields, 'label', reportMetadata.dimension);
    }
  }

  const allFieldsSorted = Object.keys({ ...allMetrics, ...allProcessedMetrics });

  // make sure nb_visits is before unique visitors if it's present so when adding directly to a report, unique visitors
  // won't be the column that gets added (since won't have data for ranges)
  const visitsIndex = allFieldsSorted.indexOf('nb_visits');
  const uniqueVisitorsIndex = allFieldsSorted.indexOf('nb_uniq_visitors');
  if (visitsIndex > 0 && uniqueVisitorsIndex > 0 && uniqueVisitorsIndex < visitsIndex) {
    allFieldsSorted.splice(visitsIndex, 1);
    allFieldsSorted.unshift('nb_visits');
  }

  const allTemporaryMetrics = new Set<string>();
  (requestedFields || allFieldsSorted).forEach((metricId) => {
    if (fields.getFieldById(metricId)) {
      return;
    }

    if (metricId === 'label') {
      if (reportMetadata.dimension) {
        addDimension(fields, 'label', reportMetadata.dimension);
      }
      return;
    }

    if (DATE_DIMENSIONS[metricId]) {
      addDateDimensions(fields, [metricId]);
      return;
    }

    if (reportMetadata.dimensions?.[metricId]) {
      addDimension(fields, metricId, reportMetadata.dimensions[metricId]);
      return;
    }

    if (allMetrics[metricId] || allProcessedMetrics[metricId]) {
      let matomoType: string;
      let aggregationType: string;

      const m = metricId.match(/^goal_\d+_(.*)/)
      if (m) {
        matomoType = reportMetadata.metricTypesGoal?.[m[1]];
        aggregationType = reportMetadata.metricAggregationTypesGoal?.[m[1]]; // TODO: handle in core (in Goals plugin)
      } else {
        matomoType = reportMetadata.metricTypes?.[metricId];
        aggregationType = reportMetadata.metricAggregationTypes?.[metricId];
      }
      matomoType = matomoType || 'text';

      const formula = reportMetadata.processedMetricFormulas?.[metricId];
      let { lookerFormula, temporaryMetrics } = mapMatomoFormulaToLooker(formula);

      temporaryMetrics.forEach(m => allTemporaryMetrics.add(m));

      addMetric(fields, metricId, allMetrics[metricId] || allProcessedMetrics[metricId], matomoType, siteCurrency, aggregationType, lookerFormula);
    } else if (metricId === 'nb_uniq_visitors') {
      // to support showing nb_uniq_visitors for day periods, but not others, we need to make sure
      // the metric appears in the schema no matter what date range is required. which means adding
      // it, even if Matomo doesn't mention it in API.getMetadata output.
      addMetric(fields, 'nb_uniq_visitors', 'Unique Visitors', 'number', siteCurrency);
    }
  });

  allTemporaryMetrics.forEach((metricId) => {
    const aggregationType = reportMetadata.temporaryMetricAggregationTypes[metricId];
    const matomoType = reportMetadata.temporaryMetricSemanticTypes[metricId];

    if (!matomoType) {
      return;
    }

    addTemporaryMetric(fields, metricId, matomoType, siteCurrency, aggregationType);
  });

  return fields;
}

export function getSelectableFieldsFromReportMetadata(
  reportMetadata: Api.ReportMetadata,
  goals: Record<string, Api.Goal>,
  siteCurrency: string,
  requestedFields?: string[],
) {
  const fields = getFieldsFromReportMetadata(reportMetadata, goals, siteCurrency, requestedFields);

  // add Date field to support time series'
  addDateDimensions(fields);

  return fields;
}
