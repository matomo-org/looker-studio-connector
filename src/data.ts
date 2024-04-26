/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import cc, { ConnectorParams } from './connector';
import * as Api from './api';
import env from './env';
import {
  throwUserError,
  throwUnexpectedError,
  callWithUserFriendlyErrorHandling,
} from './error';
import { DataTableRow } from './api';
import { debugLog } from './log';

const pastScriptRuntimeLimitErrorMessage = 'It\'s taking too long to get the requested data. This may be a momentary issue with '
  + 'your Matomo, but if it continues to occur for this report, then you may be requesting too much data. In this '
  + 'case, limit the data you are requesting to see it in Looker Studio.';

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
  'unspecified': cc.FieldType.TEXT,
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

function getReportMetadataAndGoalsAndCurrency(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
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

function getMatomoPeriodDateRange(period: string, date: string) {
  const dateObj = new Date(date);

  if (period === 'day') {
    return [dateObj, dateObj];
  }

  if (period === 'week') {
    const daysToMonday = (dateObj.getDay() + 6) % 7;

    const startWeek = new Date(dateObj.getTime());
    startWeek.setDate(dateObj.getDate() - daysToMonday);

    const endWeek = new Date(startWeek.getTime());
    endWeek.setDate(startWeek.getDate() + 6);

    return [startWeek, endWeek];
  }

  if (period === 'month') {
    const startMonth = new Date(dateObj.getTime());
    startMonth.setDate(1);

    const endMonth = new Date(dateObj.getTime());
    endMonth.setDate(1);
    endMonth.setMonth(endMonth.getMonth() + 1);
    endMonth.setDate(0);

    return [startMonth, endMonth];
  }

  if (period === 'year') {
    const startYear = new Date(dateObj.getTime());
    startYear.setMonth(0);
    startYear.setDate(1);

    const endYear = new Date(dateObj.getTime());
    endYear.setMonth(12);
    endYear.setDate(0);

    return [startYear, endYear];
  }

  throw new Error(`unknown matomo period ${period}`);
}

// exported for tests
export function detectMatomoPeriodFromRange(dateRange: GoogleAppsScript.Data_Studio.DateRange) {
  const startDateTime = (new Date(dateRange.startDate)).getTime();
  const endDateTime = (new Date(dateRange.endDate)).getTime();

  const standardMatomoPeriods = ['day', 'week', 'month', 'year'];
  const periodMatch = standardMatomoPeriods.find((period) => {
    const [matomoPeriodStart, matomoPeriodEnd] = getMatomoPeriodDateRange(period, dateRange.startDate);
    return startDateTime === matomoPeriodStart.getTime() && endDateTime === matomoPeriodEnd.getTime();
  });
  return periodMatch;
}

function getReportData(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>, requestedFields: { name: string }[]) {
  const idSite = request.configParams.idsite;
  const report = request.configParams.report;
  const segment = request.configParams.segment || '';

  let filter_truncate = -1;
  if (request.configParams.filter_limit) {
    filter_truncate = parseInt(request.configParams.filter_limit, 10);
    if (filter_truncate <= 0 || Number.isNaN(filter_truncate)) {
      throwUserError(`Invalid default row limit ${filter_truncate} supplied.`);
    }
  }

  const reportParams = JSON.parse(report) as Record<string, string>;

  const apiMethod = `${reportParams.apiModule}.${reportParams.apiAction}`;
  if (apiMethod === 'MultiSites.getAll') {
    reportParams.enhanced = '1';
  }

  const SHOW_COLUMNS_UNSUPPORTED_METHODS = [
    'VisitFrequency.get',
    'Contents.getContentPieces',
    'Contents.getContentNames',
    'Actions.getPageUrlsFollowingSiteSearch',
  ];

  let showColumns;
  // showColumns does not work correctly with some API methods
  if (!SHOW_COLUMNS_UNSUPPORTED_METHODS.includes(apiMethod)) {
    showColumns = (requestedFields.map(({name}) => name)).join(',');
  }

  let rowsToFetchAtATime = parseInt(env.MAX_ROWS_TO_FETCH_PER_REQUEST, 10) || 100000;

  const hasDate = !!(request.fields && request.fields.find((f) => f.name === 'date'));

  let period = 'range';
  let date = `${request.dateRange.startDate},${request.dateRange.endDate}`;

  if (hasDate) {
    period = 'day';

    // note: this calculation doesn't work every time, but it's good enough for determining row counts
    const MS_IN_DAY = 1000 * 60 * 60 * 24;
    let numberOfDays = Math.round(((new Date(request.dateRange.endDate)).getTime() - (new Date(request.dateRange.startDate)).getTime()) / MS_IN_DAY);
    numberOfDays = Math.max(numberOfDays, 1);

    // if we fetch multiple days, the filter_limit will be applied to every day. so we need to change the rows
    // to fetch to make sure we only select MAX_ROWS_TO_FETCH_PER_REQUEST in total.
    rowsToFetchAtATime = Math.floor(rowsToFetchAtATime / numberOfDays);
    rowsToFetchAtATime = Math.max(rowsToFetchAtATime, 1);
  } else {
    const matomoPeriod = detectMatomoPeriodFromRange(request.dateRange);
    if (matomoPeriod) {
      period = matomoPeriod;
      date = request.dateRange.startDate;
    }
  }

  // request report data one large chunk at a time to make sure we don't hit the 50mb HTTP response size limit
  // for apps scripts
  let response: Record<string, DataTableRow[]> = {};

  let offset = 0;

  let hasMoreRowsToFetch = true;
  while (hasMoreRowsToFetch) {
    const limitToUse = filter_truncate < 0 || filter_truncate >= rowsToFetchAtATime ? rowsToFetchAtATime : filter_truncate;
    let partialResponseRaw = Api.fetch<DataTableRow[]|Record<string, DataTableRow[]>>(`${reportParams.apiModule}.${reportParams.apiAction}`, {
      filter_update_columns_when_show_all_goals: '1',
      idGoal: '0', // calculate extra metrics for all goals
      ...reportParams,
      idSite: `${idSite}`,
      period,
      date,
      segment,
      format_metrics: '0',
      flat: '1',
      filter_truncate: filter_truncate <= 0 ? undefined : `${filter_truncate - 1}`,
      filter_limit: `${limitToUse}`,
      filter_offset: `${offset}`,
      showColumns,
    }, {
      checkRuntimeLimit: true,
      runtimeLimitAbortMessage: pastScriptRuntimeLimitErrorMessage,
    });

    if ((partialResponseRaw as any).value === false) {
      break; // nothing returned by request
    }

    const partialResponse = hasDate ? partialResponseRaw as Record<string, DataTableRow[]> : { [date]: partialResponseRaw as DataTableRow[] };
    Object.entries(partialResponse).forEach(([date, rows]) => {
      if (!rows) {
        rows = [];
      }

      if (!response[date]) {
        response[date] = [];
      }

      if (hasDate) {
        response[date].push(...rows.map((r) => ({ ...r, date })));
      } else {
        response[date].push(...rows);
      }
    });

    offset += limitToUse;

    hasMoreRowsToFetch = Object.values(partialResponse).some((rows) => rows.length >= limitToUse)
      && (filter_truncate < 0
        || offset < filter_truncate);
  }

  const flattenedResponse = [];
  Object.values(response).forEach((rows) => flattenedResponse.push(...rows));
  return flattenedResponse;
}

function addMetric(fields: GoogleAppsScript.Data_Studio.Fields, id: string, name: string, matomoType: string, siteCurrency: string) {
  let type = mapMatomoSemanticTypeToLooker(matomoType, siteCurrency);

  fields
    .newMetric()
    .setId(id)
    .setName(name)
    .setType(type)
    .setIsReaggregatable(false);
}

function addDimension(fields: GoogleAppsScript.Data_Studio.Fields, id: string, dimension: string) {
  fields
    .newDimension()
    .setId(id)
    .setName(dimension)
    .setType(cc.FieldType.TEXT);
}

function addDateDimension(fields: GoogleAppsScript.Data_Studio.Fields) {
  fields
    .newDimension()
    .setId('date')
    .setName('Date')
    .setType(cc.FieldType.YEAR_MONTH_DAY);
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

function getFieldsFromReportMetadata(reportMetadata: Api.ReportMetadata, goals: Record<string, Api.Goal>, siteCurrency: string, requestedFields?: string[]) {
  const fields = cc.getFields();

  let allMetrics = {
    ...reportMetadata.metrics,
    ...reportMetadata.processedMetrics,
  };

  if (reportMetadata.metricsGoal) {
    allMetrics = { ...allMetrics, ...metricsForEachGoal(reportMetadata.metricsGoal, goals) };
  }

  if (reportMetadata.processedMetricsGoal) {
    allMetrics = { ...allMetrics, ...metricsForEachGoal(reportMetadata.processedMetricsGoal, goals) };
  }

  // add goal specific conversion_rate if not present in metadata, but other goal metrics are
  // (in 4.x-dev, this is removed in the API despite the data being available)
  if (
    (reportMetadata.metricsGoal || reportMetadata.processedMetricsGoal)
    && (!reportMetadata.metricsGoal?.conversion_rate && !reportMetadata.processedMetricsGoal?.conversion_rate)
  ) {
    allMetrics = { ...allMetrics, ...metricsForEachGoal({ 'conversion_rate': 'Conversion Rate' }, goals) };
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

  const allFieldsSorted = Object.keys(allMetrics);

  // make sure nb_visits is before unique visitors if it's present so when adding directly to a report, unique visitors
  // won't be the column that gets added (since won't have data for ranges)
  const visitsIndex = allFieldsSorted.indexOf('nb_visits');
  const uniqueVisitorsIndex = allFieldsSorted.indexOf('nb_uniq_visitors');
  if (visitsIndex > 0 && uniqueVisitorsIndex > 0 && uniqueVisitorsIndex < visitsIndex) {
    allFieldsSorted.splice(visitsIndex, 1);
    allFieldsSorted.unshift('nb_visits');
  }

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

    if (metricId === 'date') {
      addDateDimension(fields);
    }

    if (reportMetadata.dimensions?.[metricId]) {
      addDimension(fields, metricId, reportMetadata.dimensions[metricId]);
      return;
    }

    if (allMetrics[metricId]) {
      let matomoType: string;

      const m = metricId.match(/^goal_\d+_(.*)/)
      if (m) {
        matomoType = reportMetadata.metricTypesGoal?.[m[1]];
      } else {
        matomoType = reportMetadata.metricTypes?.[metricId];
      }
      matomoType = matomoType || 'text';

      addMetric(fields, metricId, allMetrics[metricId], matomoType, siteCurrency);
    } else if (metricId === 'nb_uniq_visitors') {
      // to support showing nb_uniq_visitors for day periods, but not others, we need to make sure
      // the metric appears in the schema no matter what date range is required. which means adding
      // it, even if Matomo doesn't mention it in API.getMetadata output.
      addMetric(fields, 'nb_uniq_visitors', 'Unique Visitors', 'number', siteCurrency);
    }
  });

  return fields;
}

export function getSchema(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  return callWithUserFriendlyErrorHandling(`getSchema(${request.configParams?.report})`, () => {
    debugLog('getSchema(): request is', request);

    if (!request.configParams.report) {
      throwUserError('No report was selected when configuring the connector. Please go back and select one.');
    }

    if (request.configParams.filter_limit
      && Number.isNaN(parseInt(request.configParams.filter_limit, 10))
    ) {
      throwUserError(`The "Default Row Limit" entered (${request.configParams.filter_limit}) is not valid. Please enter a valid integer or leave it empty.`);
    }

    const { reportMetadata, goals, siteCurrency } = getReportMetadataAndGoalsAndCurrency(request);
    if (!reportMetadata) {
      const reportParams = JSON.parse(request.configParams.report);
      throwUnexpectedError(`The "${reportParams.apiModule}.${reportParams.apiAction}" report cannot be found in the Matomo's report metadata. (All params = ${request.configParams.report})`);
    }

    const fields = getFieldsFromReportMetadata(reportMetadata, goals, siteCurrency);

    // add Date field to support time series'
    addDateDimension(fields);

    const result = { schema: fields.build() };

    debugLog('getSchema(): result is', result);

    return result;
  });
}

export function getData(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  return callWithUserFriendlyErrorHandling(`getData(${request.configParams?.report})`, () => {
    debugLog('getData(): request is', request);

    if (!request.dateRange
      || !request.dateRange.startDate
      || !request.dateRange.endDate
    ) {
      throwUserError('A date range must be supplied.');
    }

    const { reportMetadata, goals, siteCurrency } = getReportMetadataAndGoalsAndCurrency(request);

    const fields = getFieldsFromReportMetadata(reportMetadata, goals, siteCurrency, request.fields?.map((r) => r.name));

    let requestedFields = request.fields;
    if (!requestedFields) {
      requestedFields = fields.asArray().map((f) => ({ name: f.getId() }));
    }
    requestedFields = requestedFields.filter(({ name }) => fields.getFieldById(name));

    // field instances can be garbage collected if we don't request them specifically first
    const requestedFieldObjects = requestedFields.map(({ name }) => fields.getFieldById(name));

    let reportData = getReportData(request, requestedFields);
    if (reportData === null) {
      const reportParams = JSON.parse(request.configParams.report);
      throwUnexpectedError(`The "${reportParams.apiModule}.${reportParams.apiAction}" report cannot be found in the Matomo's report metadata.`);
    }

    // API methods that return DataTable\Simple instances are just one row, not an array of rows, so we wrap them
    // in an array in this case
    reportData = Array.isArray(reportData) ? reportData : [reportData];

    const data = reportData.map((row) => {
      const fieldValues = requestedFields
        .map(({ name }, index) => {
          if (typeof row[name] !== 'undefined'
            && row[name] !== false // edge case that can happen in some report output
          ) {
            let value = row[name];

            // perform any transformations on the value required by the Matomo type
            let matomoType = reportMetadata?.metricTypes?.[name];
            if (name === 'date') {
              matomoType = 'date';
            }

            if (matomoType === 'duration_ms') {
              value = parseInt(value as string, 10) / 1000;
            } else if (matomoType === 'date') {
              // value is in YYYY-MM-DD format, but must be converted to YYYYMMDD
              value = value.toString().replace(/-/g, '');
            } else if (matomoType === 'datetime') {
              // value is in YYYY-MM-DD HH:MM:SS format, but must be converted to YYYYMMDDHHMMSS
              value = value.toString().replace(/[-:\s]/g, '');
            } else if (matomoType === 'timestamp') {
              // value is a timestamp, but must be converted to YYYYMMDDHHMMSS
              const d = new Date(parseInt(value as string, 10));
              value = `${d.getUTCFullYear()}${d.getUTCMonth() + 1}${d.getUTCDate()}${d.getUTCHours()}${d.getUTCMinutes()}${d.getUTCSeconds()}`;
            }

            // NOTE: the value MUST be a string, even if it's declared a number or something else. Looker studio will
            // fumble sometimes when it's not a string (for example, when the metric is marked as a duration) and
            // fail to display the data.
            return `${value}`;
          }

          // no value found
          const field = requestedFieldObjects[index];
          if (field.isDimension()
            && request.configParams.filter_limit
            && parseInt(request.configParams.filter_limit, 10) > 0
          ) {
            return row['label'];
          }

          const type = field.getType();
          if (type === cc.FieldType.TEXT) {
            return '';
          }

          return '0';
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

    debugLog('getData(): result is', { ...result, rows: 'redacted' });

    return result;
  });
}
