/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import dayjs from 'dayjs/esm';
import weekOfYear from 'dayjs/esm/plugin/weekOfYear';
import cc, { ConnectorParams } from './connector';
import * as Api from './api';
import env from './env';
import {
  throwUserError,
  throwUnexpectedError,
  callWithUserFriendlyErrorHandling,
} from './error';
import {
  DATE_DIMENSIONS,
  convertMatomoTypeToLooker,
} from './schema/data-types';
import {
  getReportMetadataAndGoalsAndCurrency,
  getFieldsFromReportMetadata,
  getSelectableFieldsFromReportMetadata,
} from './schema/report-metadata';
import { DataTableRow } from './api';
import { debugLog } from './log';
import { detectMatomoPeriodFromRange } from './matomo/period';

dayjs.extend(weekOfYear);

const pastScriptRuntimeLimitErrorMessage = 'It\'s taking too long to get the requested data. This may be a momentary issue with '
  + 'your Matomo, but if it continues to occur for this report, then you may be requesting too much data. In this '
  + 'case, limit the data you are requesting to see it in Looker Studio.';

function getReportData(
  request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>,
  requestedFields: { name: string }[],
  requiredTemporaryMetrics: string[],
) {
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

  let showRawMetrics = requiredTemporaryMetrics.length ? '1' : '0';

  let showColumns;
  // showColumns does not work correctly with some API methods
  if (!SHOW_COLUMNS_UNSUPPORTED_METHODS.includes(apiMethod)) {
    let showColumnsMetrics = requestedFields.map(({name}) => name);
    if (requiredTemporaryMetrics.length) {
      showColumnsMetrics.push(...requiredTemporaryMetrics);
    }

    showColumns = showColumnsMetrics.join(',');
  }

  let rowsToFetchAtATime = parseInt(env.MAX_ROWS_TO_FETCH_PER_REQUEST, 10) || 100000;

  const dateMetricIfPresent = request.fields && request.fields
    .filter((f) => DATE_DIMENSIONS[f.name])
    .pop(); // always use the last occurrence, since 'date' will be requested along with the other dimension

  let period = 'range';
  let date = `${request.dateRange.startDate},${request.dateRange.endDate}`;

  if (dateMetricIfPresent) {
    period = dateMetricIfPresent.name.split('_')[1] || 'day';

    // note: this calculation is imprecise, but it's good enough for determining row counts
    const MS_IN_DAY = 1000 * 60 * 60 * 24;

    let numberOfPeriods = Math.round(((new Date(request.dateRange.endDate)).getTime() - (new Date(request.dateRange.startDate)).getTime()) / MS_IN_DAY);
    numberOfPeriods = numberOfPeriods / DATE_DIMENSIONS[dateMetricIfPresent.name].daysInPeriod;
    numberOfPeriods = Math.max(numberOfPeriods, 1);

    // if we fetch multiple days, the filter_limit will be applied to every day. so we need to change the rows
    // to fetch to make sure we only select MAX_ROWS_TO_FETCH_PER_REQUEST in total.
    rowsToFetchAtATime = Math.floor(rowsToFetchAtATime / numberOfPeriods);
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

    const params: Record<string, string> = {
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
      showRawMetrics,
    };

    if (reportParams.apiModule !== 'Goals') {
      params.filter_update_columns_when_show_all_goals = '1';
      params.idGoal = '0'; // calculate extra metrics for all goals
    }

    let partialResponseRaw = Api.fetch<DataTableRow[]|Record<string, DataTableRow[]>>(`${reportParams.apiModule}.${reportParams.apiAction}`, params, {
      checkRuntimeLimit: true,
      runtimeLimitAbortMessage: pastScriptRuntimeLimitErrorMessage,
    });

    if ((partialResponseRaw as any).value === false) {
      break; // nothing returned by request
    }

    const partialResponse = dateMetricIfPresent ? partialResponseRaw as Record<string, DataTableRow[]> : { [date]: partialResponseRaw as DataTableRow[] };
    Object.entries(partialResponse).forEach(([date, rows]) => {
      if (!rows) {
        rows = [];
      }

      if (!response[date]) {
        response[date] = [];
      }

      if (dateMetricIfPresent) {
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

    const fields = getSelectableFieldsFromReportMetadata(reportMetadata, goals, siteCurrency);

    const result = { schema: fields.build() };

    debugLog('getSchema(): result is', JSON.stringify(result));

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

    // get all temporary metrics required by requested processed metrics
    const temporaryMetrics = fields.asArray().filter(f => f.isDefault()).map(f => f.getId());

    // field instances can be garbage collected if we don't request them specifically first
    const requestedFieldObjects = requestedFields.map(({ name }) => fields.getFieldById(name));

    let reportData = getReportData(request, requestedFields, temporaryMetrics);
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
          let matomoType = reportMetadata?.metricTypes?.[name];
          if (DATE_DIMENSIONS[name]) {
            matomoType = name;
            name = 'date';
          }

          let value = convertMatomoTypeToLooker(row[name], matomoType);
          if (value) {
            return value;
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
