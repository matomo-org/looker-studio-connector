/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

const appscriptPath = path.join(__dirname, '..', '..', 'src', 'appsscript.json');

describe('other', () => {
  describe('appscript.json', () => {
    it('should have a valid logoUrl', async () => {
      const contentsJson = fs.readFileSync(appscriptPath).toString('utf-8');
      const contents: any = JSON.parse(contentsJson);
      const logoUrl = contents.dataStudio.logoUrl;

      const logo = await axios({
        method: 'GET',
        url: logoUrl,
      });

      expect(logo.data?.length).toBeGreaterThan(50);
    });
  });
});
