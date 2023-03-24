/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

// NOTE: this file must be in JS not TypeScript, otherwise jest will not be able to run it successfully

const path = require('path');
const fs = require('fs');
const execSync = require('child_process').execSync;
const Clasp = require('../utilities/clasp').default;

const appsScriptPath = path.join(__dirname, '../../src/appsscript.json');
const backupAppsScriptPath = path.join(__dirname, './appsscript.backup.json');

module.exports = async function () {
    // allow executing the project
    if (fs.existsSync(backupAppsScriptPath)) {
        fs.unlinkSync(backupAppsScriptPath);
    }
    fs.linkSync(appsScriptPath, backupAppsScriptPath);

    const appsScriptContent = JSON.parse(fs.readFileSync(appsScriptPath).toString('utf-8'));
    appsScriptContent.executionApi = { access: 'ANYONE' };

    fs.writeFileSync(appsScriptPath, JSON.stringify(appsScriptContent, null, 2));

    execSync('npm run build:unit');

    await Clasp.push();
};
