/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { ConnectorParams } from '../connector';

interface ConfigSection {
  isFilledOut(params?: ConnectorParams): boolean;

  validate(params?: ConnectorParams): void;

  addControls(config: GoogleAppsScript.Data_Studio.Config, params?: ConnectorParams): void;
}

export default ConfigSection;
