/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import cc from '../connector';
import dayjs from "dayjs/esm";

export const MATOMO_SEMANTIC_TYPE_TO_LOOKER_MAPPING = {
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

export function mapMatomoSemanticTypeToLooker(matomoType: string, siteCurrencyCode: string) {
  let mapped = MATOMO_SEMANTIC_TYPE_TO_LOOKER_MAPPING[matomoType] || cc.FieldType.TEXT;
  if (mapped === 'currency') {
    // NOTE: not all currencies supported in Matomo are supported by looker studio
    mapped = cc.FieldType[`CURRENCY_${siteCurrencyCode.toUpperCase()}`] || cc.FieldType.NUMBER;
  }
  return mapped;
}

export const DATE_DIMENSIONS = {
  date: {
    name: 'Date',
    type: cc.FieldType.YEAR_MONTH_DAY,
    daysInPeriod: 1,
  },
  date_month: {
    name: 'Month',
    type: cc.FieldType.YEAR_MONTH,
    daysInPeriod: 30,
  },
  date_week: {
    name: 'Week (Mon - Sun)',
    type: cc.FieldType.YEAR_WEEK,
    daysInPeriod: 7,
  },
  date_year: {
    name: 'Year',
    type: cc.FieldType.YEAR,
    daysInPeriod: 365,
  },
};

export function convertMatomoTypeToLooker(value: any, matomoType: string) {
  if (typeof value === 'undefined'
    || value === false // edge case that can happen in some report output
  ) {
    return null;
  }

  // perform any transformations on the value required by the Matomo type
  if (matomoType === 'duration_ms') {
    value = parseInt(value as string, 10) / 1000;
  } else if (matomoType === 'date') {
    // value is in YYYY-MM-DD format, but must be converted to YYYYMMDD
    value = value.toString().replace(/-/g, '');
  } else if (matomoType === 'date_month') {
    // value is in YYYY-MM-DD format, but must be converted to YYYYMM
    value = value.toString().split('-').slice(0, 2).join('');
  } else if (matomoType === 'date_week') {
    // value is in YYYY-MM-DD, but must be converted to YYYYww
    const start = value.split(',')[0];
    value = start.toString().split('-').shift() + dayjs(start).week().toString().padStart(2, '0');
  } else if (matomoType === 'date_year') {
    value = value.toString().split('-').shift();
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
