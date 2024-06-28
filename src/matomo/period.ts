/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

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
