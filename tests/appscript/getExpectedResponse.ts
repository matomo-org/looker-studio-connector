/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import * as path from 'path';
import * as fs from 'fs';
import stringify from 'json-stringify-deterministic';

export default function getExpectedResponse(actualContent: unknown, suiteName: string, testName: string) {
  fs.mkdirSync(path.join(__dirname, 'actual'), { recursive: true });

  const processedFilePath = path.join(__dirname, 'actual', `${suiteName}_${testName}.json`);
  if (fs.existsSync(processedFilePath)) {
    fs.unlinkSync(processedFilePath);
  }
  fs.writeFileSync(processedFilePath, (stringify as any)(actualContent, { space: '  ' }));

  const expectedFilePath = path.join(__dirname, 'expected', `${suiteName}_${testName}.json`);
  if (!fs.existsSync(expectedFilePath)) {
    fs.writeFileSync(expectedFilePath, '{}');
  }

  const contents = fs.readFileSync(expectedFilePath).toString('utf-8').trim();
  return JSON.parse(contents);
}
