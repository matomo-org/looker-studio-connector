/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import * as Api from './api';
import cc from './connector';

const DEBUG = true; // TODO: replace w/ dotenv

export function getAuthType() {
    return cc.newAuthTypeResponse()
        .setAuthType(cc.AuthType.USER_TOKEN)
        .setHelpUrl('https://matomo.org/TODO') // TODO
        .build();
}

export function checkForValidCreds(instanceUrl?: string, token?: string) {
    try {
        const responseContent = Api.fetch('SitesManager.getSitesIdWithViewAccess', {}, {
            instanceUrl,
            token,
        });
        return Array.isArray(responseContent) && !!responseContent.length;
    } catch (error) {
        return false;
    }
}

export function setCredentials(request) {
    const { username, token } = request.userToken;

    const instanceUrl = username;

    const isValidCreds = checkForValidCreds(instanceUrl, token);
    if (!isValidCreds) {
        return {
            errorCode: 'INVALID_CREDENTIALS',
        };
    }

    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('dscc.username', instanceUrl);
    userProperties.setProperty('dscc.token', token);

    return {
        errorCode: 'NONE',
    };
}

export function isAuthValid() {
    return checkForValidCreds();
}

export function resetAuth() {
    const userTokenProperties = PropertiesService.getUserProperties();
    userTokenProperties.deleteProperty('dscc.username');
    userTokenProperties.deleteProperty('dscc.password');
}

export function isAdminUser() {
    return DEBUG;
}
