/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import * as path from 'path';
import * as fs from 'fs';
import { beforeAll, afterAll } from '@jest/globals';
import Clasp from '../utilities/clasp';

const appsScriptPath = path.join(__dirname, '../../src/appsscript.json');
const backupAppsScriptPath = path.join(__dirname, './appsscript.backup.json');

const callFunctionInTestTarget = path.join(__dirname, '../../src/callFunctionInTest.ts');
const callFunctionInTestSource = path.join(__dirname, '../utilities/callFunctionInTest.ts');

// TODO: check following statement again later
// can't use globalSetup for this, jest has trouble with allowing global setup to be in typescript
beforeAll(async () => {
  // allow executing the project
  if (fs.existsSync(backupAppsScriptPath)) {
    fs.unlinkSync(backupAppsScriptPath);
  }
  fs.linkSync(appsScriptPath, backupAppsScriptPath);

  const appsScriptContent = JSON.parse(fs.readFileSync(appsScriptPath).toString('utf-8'));
  appsScriptContent.executionApi = { access: 'ANYONE' };

  // add callFunctionInTest.ts to project temporarily
  if (fs.existsSync(callFunctionInTestTarget)) {
    fs.unlinkSync(callFunctionInTestTarget);
  }
  fs.linkSync(callFunctionInTestSource, callFunctionInTestTarget);

  fs.writeFileSync(appsScriptPath, JSON.stringify(appsScriptContent, null, 2));

  await Clasp.push();
});

afterAll(() => {
  // restore unmodified appsscript.backup.json
  fs.unlinkSync(appsScriptPath);
  fs.linkSync(backupAppsScriptPath, appsScriptPath);

  // remove callFunctionInTest.ts file from project
  if (fs.existsSync(callFunctionInTestTarget)) {
    fs.unlinkSync(callFunctionInTestTarget);
  }
});
