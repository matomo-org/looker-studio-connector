/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { callWithUserFriendlyErrorHandling } from '../src/error';
import cc from '../src/connector';

export function callWithUserFriendlyErrorHandling_forceUncaught() {
  callWithUserFriendlyErrorHandling('forceUncaughtTest', () => {
    throw new Error('test message');
  });
}

export function callWithUserFriendlyErrorHandling_forceConnectorError() {
  callWithUserFriendlyErrorHandling('forceConnectorErrorTest', () => {
    cc.newUserError().setText('test connector user error').throwException();
  });
}

export function callWithUserFriendlyErrorHandling_forceLookerStudioUncaught() {
  callWithUserFriendlyErrorHandling('forceConnectorErrorTest', () => {
    const fields = cc.getFields();
    fields.newMetric().setId('metric').setName('Metric').setType(cc.FieldType.NUMBER);
    fields.newMetric().setId('metric').setName('Metric').setType(cc.FieldType.NUMBER);
    fields.build();
  });
}
