/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

// TODO: change spacing to 2 spaces, not 4
import cc from './connector';
import * as Api from './api';

function getOptionValuesFromInstance() {
    const [sitesWithViewAccess, segments, reports] = Api.fetchAll([
        { method: 'SitesManager.getSitesWithAtLeastViewAccess' },
        { method: 'SegmentEditor.getAll' },
        { method: 'API.getReportMetadata', params: { idSites: 'all', period: 'day', date: 'yesterday' } },
    ]);

    return {
        sitesWithViewAccess: sitesWithViewAccess as Api.Site[],
        segments: segments as Api.StoredSegment[],
        reports: reports,
    };
}

export function getConfig() {
    const config = cc.getConfig();

    const { sitesWithViewAccess, segments, reports } = getOptionValuesFromInstance();

    // idsite select
    let idSiteSelect = config
        .newSelectSingle()
        .setId('idsite')
        .setName('Website/Measurable')
        .setAllowOverride(true);

    sitesWithViewAccess.forEach((site) => {
        idSiteSelect = idSiteSelect.addOption(config.newOptionBuilder().setLabel(site.name).setValue(`${site.idsite}`));
    });

    // segment select
    let segmentSelect = config
        .newSelectSingle()
        .setId('segment')
        .setName('Segment')
        .setAllowOverride(true)
        .addOption(config.newOptionBuilder().setLabel('All Visits').setValue(''));

    segments.forEach((segment) => {
        segmentSelect = segmentSelect.addOption(
          config.newOptionBuilder().setLabel(segment.name).setValue(segment.definition),
        );
    });

    // report select
    let reportSelect = config
        .newSelectSingle()
        .setId('report')
        .setName('Report')
        .setAllowOverride(true);

    reports.forEach((report) => {
        reportSelect = reportSelect.addOption(
          config.newOptionBuilder().setLabel(report.name).setValue(`${report.module}.${report.action}`),
        );
    });

    config.setDateRangeRequired(true);

    return config.build();
}
