/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

export function setScriptProperties(properties: Record<string, string>, deleteAllOthers = false) {
  PropertiesService.getScriptProperties().setProperties(properties, deleteAllOthers);
}
