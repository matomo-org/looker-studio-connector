/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import puppeteer, { Browser, Page } from 'puppeteer';

const { LOOKER_STUDIO_TEST_REPORT } = process.env;

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await puppeteer.launch({ headless: false });
  page = await browser.newPage();
});

afterAll(async () => {
  if (browser) {
    await browser.close();
  }
});

describe('simple', () => {
  it('should run', async () => {
    await page.goto(LOOKER_STUDIO_TEST_REPORT);
    await new Promise((resolve) => setTimeout(resolve, 4000));
  });
});
