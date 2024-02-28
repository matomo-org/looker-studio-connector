/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import Koa from 'koa';

interface MockServerOptions {
  onRandomError?: () => void;
  onNonRandomError?: () => void;
}

interface MockMatomo4ServerOptions {
  matomoVersion?: string;
}

export function makeApiFailureMockServer(port: number = 3000, options: MockServerOptions = {}) {
  const app = new Koa();

  app.use((ctx) => {
    const { pathname, search } = new URL(`http://ignored.com${ctx.url}`);

    if (!/SitesManager\.getSitesIdWithAtLeastViewAccess/.test(search)) {
      if (/^\/forced-random-error\//.test(pathname)) {
        if (options.onRandomError) {
          options.onRandomError();
        }

        ctx.status = 504;
        ctx.body = 'test 504';
        return;
      }

      if (/^\/forced-nonrandom-error\//.test(pathname)) {
        if (options.onNonRandomError) {
          options.onNonRandomError();
        }

        ctx.status = 400;
        ctx.body = 'test 400';
        return;
      }
    }

    // assumes SitesManager.getSitesIdWithAtLeastViewAccess was called
    ctx.status = 200;
    ctx.body = '[1]';
  });

  return app.listen(port);
}

export function makeMatomo4MockServer(port: number = 3000, options: MockMatomo4ServerOptions = {}) {
  const app = new Koa();

  app.use((ctx) => {
    const { pathname, search } = new URL(`http://ignored.com${ctx.url}`);

    if (/SitesManager\.getSitesIdWithAtLeastViewAccess/.test(search)) {
      ctx.status = 200;
      ctx.body = '[1]';
    }

    if (/API.getMatomoVersion/.test(search)) {
      ctx.status = 200;
      ctx.body = JSON.stringify({ value: options.matomoVersion || '4.13.0-b4' });
    }

    ctx.status = 200;
    ctx.body = '';
  });

  return app.listen(port);
}
