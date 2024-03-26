/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { ConnectorParams } from './connector';
import cc from './connector';
import {
  callWithUserFriendlyErrorHandling
} from './error';
import { debugLog } from './log';
import ConfigSection from './config/section';
import SelectWebsite from './config/select-website';
import ReportAndRequest from './config/report-and-request';

const CONFIG_STEPS = <ConfigSection[]>[
  new SelectWebsite(),
  new ReportAndRequest(),
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
  return callWithUserFriendlyErrorHandling('getConfig()', () => {
    debugLog('getConfig(): request is', request);

    const configParams = request.configParams;

    const currentStep = getCurrentStep(request);

    debugLog('getConfig(): current step is', currentStep);

    const config = cc.getConfig();
    if (currentStep < CONFIG_STEPS.length - 1) {
      config.setIsSteppedConfig(true);
    }

    CONFIG_STEPS.forEach((step, index) => {
      if (currentStep >= index) {
        if (currentStep > index && step.validate) { // validate previous step entry
          step.validate(configParams);
        }

        step.addControls(config, configParams);
      }
    });

    if (currentStep >= CONFIG_STEPS.length - 1) {
      config.setIsSteppedConfig(false);
      config.setDateRangeRequired(true);
    }

    const result = config.build();

    debugLog('getConfig(): result is', result);

    return result;
  });
}
