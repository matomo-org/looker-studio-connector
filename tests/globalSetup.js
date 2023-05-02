/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

// NOTE: this file must be in JS not TypeScript, otherwise jest will not be able to run it successfully

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const axios = require('axios');
const execSync = require('child_process').execSync;
const Clasp = require('./utilities/clasp').default;
const env = require('./env').default;

const appsScriptPath = path.join(__dirname, '../src/appsscript.json');

module.exports = async function () {
    // allow executing the project
    const appsScriptContent = JSON.parse(fs.readFileSync(appsScriptPath).toString('utf-8'));
    appsScriptContent.executionApi = { access: 'ANYONE' };

    fs.writeFileSync(appsScriptPath, JSON.stringify(appsScriptContent, null, 2));

    execSync('npm run build:test');

    await Clasp.push();

    Clasp.startWatchingLogs();

    // request data used to dynamically generate test cases (which cannot be done within a describe() call)
    const url = `${env.APPSCRIPT_TEST_MATOMO.replace(/[/]+$/g, '')}/index.php?idSite=${env.APPSCRIPT_TEST_IDSITE}&period=day&date=today&module=API&method=API.getReportMetadata&token_auth=${env.APPSCRIPT_TEST_TOKEN}&format=JSON`;
    const response = await axios({
        method: 'GET',
        url,
    });
    const allReportMethods = response.data.filter((r) => !(r.module === 'MultiSites' && r.action === 'getOne'));
    global.ALL_REPORT_METADATA = allReportMethods;
};
