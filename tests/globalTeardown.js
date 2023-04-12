/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

// NOTE: this file must be in JS not TypeScript, otherwise jest will not be able to run it successfully

const path = require('path');
const fs = require('fs');
const Clasp = require('./utilities/clasp').default;

const appsScriptPath = path.join(__dirname, '../src/appsscript.json');

module.exports = function () {
    // restore unmodified appsscript.json
    const appsScriptContent = JSON.parse(fs.readFileSync(appsScriptPath).toString('utf-8'));
    delete appsScriptContent.executionApi;

    fs.writeFileSync(appsScriptPath, JSON.stringify(appsScriptContent, null, 2));

    Clasp.stopWatchingLogs();
};
