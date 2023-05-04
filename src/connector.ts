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
  hierarchical?: boolean; // if false, flat=1, otherwise flat=0 (done this way so we default to flat)
  language?: string;
}

export default DataStudioApp.createCommunityConnector();

// used to detect script elapsed time and whether it is close to the apps script time limit
export const scriptStartTime = Date.now();

export function getScriptElapsedTime() {
  return Date.now() - scriptStartTime;
}