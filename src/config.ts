/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { ConnectorParams } from './connector';
import * as Api from './api';
import cc from './connector';

interface ConfigStep {
  isFilledOut(params?: ConnectorParams): boolean;
  validate(params?: ConnectorParams): void;
  addControls(config: GoogleAppsScript.Data_Studio.Config, params?: ConnectorParams): void;
}

const CONFIG_STEPS = <ConfigStep[]>[
  // first step: select website
  {
    isFilledOut(params: ConnectorParams) {
      return typeof params?.idsite !== 'undefined';
    },
    validate(params?: ConnectorParams) {
      if (!params?.idsite || parseInt(params.idsite, 10) < 0) {
        cc.newUserError()
          .setText('A website in your Matomo must be selected.')
          .throwException();
      }
    },
    addControls(config: GoogleAppsScript.Data_Studio.Config) {
      // TODO: these requests could be cached
      const sitesWithViewAccess = Api.fetch<Api.Site[]>('SitesManager.getSitesWithAtLeastViewAccess');

      // idsite select
      let idSiteSelect = config
        .newSelectSingle()
        .setId('idsite')
        .setName('Website/Measurable')
        .setIsDynamic(true);

      sitesWithViewAccess.forEach((site) => {
        idSiteSelect = idSiteSelect.addOption(config.newOptionBuilder().setLabel(site.name).setValue(`${site.idsite}`));
      });
    },
  },

  // second step: pick report category
  {
    isFilledOut(params?: ConnectorParams) {
      return typeof params?.reportCategory !== 'undefined';
    },
    validate(params?: ConnectorParams) {
      const category = (params?.reportCategory || '').trim();
      if (!category) {
        cc.newUserError()
          .setText('Please select a report category to continue.')
          .throwException();
      }
    },
    addControls(config: GoogleAppsScript.Data_Studio.Config, params?: ConnectorParams) {
      // TODO: also add text info boxes where we can
      const reportMetadata = Api.fetch<Api.ReportMetadata[]>('API.getReportMetadata', {
        idSite: params!.idsite,
        period: 'day',
        date: 'yesterday',
      });

      const categories = Object.keys(reportMetadata.reduce((cats, r) => {
        cats[r.category] = true;
        return cats;
      }, {}));

      let reportCategorySelect = config
        .newSelectSingle()
        .setId('reportCategory')
        .setName('Report Category')
        .setIsDynamic(true);

      categories.forEach((cat) => {
        reportCategorySelect = reportCategorySelect.addOption(config.newOptionBuilder().setLabel(cat).setValue(cat));
      });
    },
  },

  // third step: pick report
  {
    isFilledOut(params?: ConnectorParams) {
      return typeof params?.report !== 'undefined';
    },
    validate(params?: ConnectorParams) {
      const report = (params?.report || '').trim();
      if (!report) {
        cc.newUserError()
          .setText('Please select a Matomo report to connect to.')
          .throwException();
      }
    },
    addControls(config: GoogleAppsScript.Data_Studio.Config, params?: ConnectorParams) {
      const reportMetadata = Api.fetch<Api.ReportMetadata[]>('API.getReportMetadata', {
        idSite: params!.idsite,
        period: 'day',
        date: 'yesterday',
      });

      let reportSelect = config
        .newSelectSingle()
        .setId('report')
        .setName('Report');

      reportMetadata.forEach((report) => {
        const value = JSON.stringify({
          ...report.parameters,
          apiModule: report.module,
          apiAction: report.action,
        });

        reportSelect = reportSelect.addOption(
          config.newOptionBuilder().setLabel(report.name).setValue(value),
        );
      });
    },
  },

  // fourth step: set report parameter defaults
  {
    isFilledOut(params?: ConnectorParams) {
      return typeof params.segment !== 'undefined';
    },
    validate(params?: ConnectorParams) {
      // empty
    },
    addControls(config: GoogleAppsScript.Data_Studio.Config) {
      // segment select
      const segments = Api.fetch<Api.StoredSegment[]>('SegmentEditor.getAll');

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

      // TODO: make sure to validate value somehow
      // filter_limit input
      config
        .newTextInput()
        .setId('filter_limit')
        .setName('Default Row Limit')
        .setAllowOverride(true)
        .setHelpText('TODO');

      // TODO: other useful parameter defaults
    },
  },
];

function getCurrentStep(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
    const configParams = request.configParams;

    if (!configParams) {
        return 0;
    }

    const stepsReversed = [...CONFIG_STEPS].reverse();
    return stepsReversed.length - stepsReversed.findIndex((step) => step.isFilledOut(configParams));
}

export function getConfig(request: GoogleAppsScript.Data_Studio.Request<ConnectorParams>) {
  const configParams = request.configParams;

  const currentStep = getCurrentStep(request);

  const config = cc.getConfig();
  if (currentStep < CONFIG_STEPS.length - 1) {
    config.setIsSteppedConfig(true);
  }

  CONFIG_STEPS.forEach((step, index) => {
    if (currentStep >= index) {
      if (currentStep - 1 === index && step.validate) { // validate previous step entry
        step.validate(configParams);
      }

      step.addControls(config, configParams);
    }
  });

  if (currentStep >= CONFIG_STEPS.length - 1) {
    config.setIsSteppedConfig(false);
    config.setDateRangeRequired(true);
  }

  return config.build();
}
