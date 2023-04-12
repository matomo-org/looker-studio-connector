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
const backupAppsScriptPath = path.join(__dirname, './appsscript.backup.json');

module.exports = function () {
    // restore unmodified appsscript.backup.json
    fs.unlinkSync(appsScriptPath);
    fs.linkSync(backupAppsScriptPath, appsScriptPath);

    Clasp.stopWatchingLogs();
};
