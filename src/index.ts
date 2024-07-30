/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { MATOMO_SEMANTIC_TYPE_TO_LOOKER_MAPPING } from './schema/data-types';

export { extractBasicAuthFromUrl, fetchAll } from './api';
export * from './auth';
export * from './config';
export * from './data';

// exported for tests
export function getMatomoSemanticTypeToLookerMapping() {
  return MATOMO_SEMANTIC_TYPE_TO_LOOKER_MAPPING;
}
export { detectMatomoPeriodFromRange } from './matomo/period';
