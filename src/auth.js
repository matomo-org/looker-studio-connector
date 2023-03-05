var cc = DataStudioApp.createCommunityConnector();

var DEBUG = true;

function getAuthType() {
    var cc = DataStudioApp.createCommunityConnector();
    return cc.newAuthTypeResponse()
        .setAuthType(cc.AuthType.USER_TOKEN)
        .setHelpUrl('https://matomo.org/TODO') // TODO
        .build();
}

function checkForValidCreds(instanceUrl, token) {
    var url = instanceUrl;
    url += 'index.php?module=API&method=SitesManager.getSitesIdWithViewAccess&format=JSON&token_auth=' + encodeURIComponent(token);
    try {
        var response = UrlFetchApp.fetch(url);
        var responseContent = JSON.parse(response.getContentText("UTF-8"));

        return Array.isArray(responseContent) && !!responseContent.length;
    } catch (error) {
        return false;
    }
}

function setCredentials(request) {
    var creds = request.userToken;
    var instanceUrl = creds.username; // NOTE: username is matomo instance URL
    var token = creds.token;

    if (!/\/$/.test(instanceUrl)) {
        instanceUrl += '/';
    }

    var validCreds = checkForValidCreds(instanceUrl, token);
    if (!validCreds) {
        return {
            errorCode: 'INVALID_CREDENTIALS'
        };
    }

    var userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('dscc.username', instanceUrl);
    userProperties.setProperty('dscc.token', token);
    return {
        errorCode: 'NONE'
    };
}

function isAuthValid() {
    var userProperties = PropertiesService.getUserProperties();
    var instanceUrl = userProperties.getProperty('dscc.username');
    var token = userProperties.getProperty('dscc.token');
    var result = checkForValidCreds(instanceUrl, token);
    return result;
}

function resetAuth() {
    var userTokenProperties = PropertiesService.getUserProperties();
    userTokenProperties.deleteProperty('dscc.username');
    userTokenProperties.deleteProperty('dscc.password');
}

function isAdminUser() {
    return DEBUG;
}
