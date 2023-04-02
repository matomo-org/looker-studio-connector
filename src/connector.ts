/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

export interface ConnectorParams {
  idsite?: string;
  reportCategory?: string;
  report?: string;
  segment?: string;
  filter_limit?: string;
}

export default DataStudioApp.createCommunityConnector();

// used to detect script elapsed time and whether it is close to the apps script time limit
export const scriptStartTime = Date.now();

export function getScriptElapsedTime() {
  return Date.now() - scriptStartTime;
}