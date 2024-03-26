/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import ConfigSection from './section';
import { ConnectorParams } from '../connector';
import { throwUserError } from '../error';
import { log } from '../log';
import { getMatomoVersion, getSitesWithAtLeastViewAccess } from './api-queries';

export default class SelectWebsite implements ConfigSection {
  isFilledOut(params: ConnectorParams) {
    return typeof params?.idsite !== 'undefined';
  }

  validate(params?: ConnectorParams) {
    if (!params?.idsite || parseInt(params.idsite, 10) < 0) {
      throwUserError('A website in your Matomo must be selected.');
    }
  }

  addControls(config: GoogleAppsScript.Data_Studio.Config) {
    // add info explaining that authors of Matomo and the connector do not get access to your data
    const link = 'https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes';
    config.newInfo().setId('google-info-notice')
      .setText(
        'Note: The Matomo Connector for Looker Studio\'s use and transfer of information received from Google APIs ' +
        `to any other app will adhere to Google API Services User Data Policy (${link}), including the Limited Use ` +
        'requirements.'
      );

    const reportTemplateLink = 'https://matomo.org/faq/looker-studio/matomo-connector-template-report/';
    config.newInfo().setId('new-to-looker')
      .setText(
        `New to Looker Studio? Get started quickly with our template Matomo report: ${reportTemplateLink}`
      );

    try {
      const matomoVersion = getMatomoVersion();
      if (matomoVersion.major < 4
        || (matomoVersion.major === 4 && matomoVersion.minor < 14)
      ) {
        config.newInfo()
          .setId('matomo-4-warning')
          .setText(`WARNING: You are trying to connect to a version ${matomoVersion.major}.${matomoVersion.minor} Matomo. This connector ` +
            'works best with version 4.14 or greater. Other versions will not be able to provide Looker Studio ' +
            'with all necessary information.');
      }
    } catch (e) {
      log(`Failed to get matomo version: ${e.stack || e.message || e}`);
    }

    const sitesWithViewAccess = getSitesWithAtLeastViewAccess();

    // idsite select
    let idSiteSelect = config
      .newSelectSingle()
      .setId('idsite')
      .setName('Website/Measurable')
      .setIsDynamic(true);

    sitesWithViewAccess.forEach((site) => {
      idSiteSelect = idSiteSelect.addOption(config.newOptionBuilder().setLabel(site.name).setValue(`${site.idsite}`));
    });
  }
}
