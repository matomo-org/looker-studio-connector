/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import env from '../env';
import * as Api from '../api';

const CONFIG_REQUEST_CACHE_TTL_SECS = parseInt(env.CONFIG_REQUEST_CACHE_TTL_SECS, 10) || 0;

export function getMatomoVersion() {
  const version = Api.fetch<{ value: string }>(
    'API.getMatomoVersion',
    {},
    {
      cacheKey: 'getConfig.API.getMatomoVersion',
      cacheTtl: CONFIG_REQUEST_CACHE_TTL_SECS,
    }
  ).value;
  const [major, minor] = version.split('.').map((s) => parseInt(s, 10));
  return { major, minor };
}

export function getSitesWithAtLeastViewAccess() {
  return Api.fetch<Api.Site[]>('SitesManager.getSitesWithAtLeastViewAccess', {
    filter_limit: '-1',
  }, {
    cacheKey: 'getConfig.SitesManager.getSitesWithAtLeastViewAccess',
    cacheTtl: CONFIG_REQUEST_CACHE_TTL_SECS,
  });
}

export function getSegments(idSite: string) {
  return Api.fetch<Api.StoredSegment[]>('SegmentEditor.getAll', {
    idSite,
    filter_limit: '-1',
  }, {
    cacheKey: `getConfig.SegmentEditor.getAll.${idSite}`,
    cacheTtl: CONFIG_REQUEST_CACHE_TTL_SECS,
  });
}

export function getLanguages() {
  return Api.fetch<Api.Language[]>(
    'LanguagesManager.getAvailableLanguageNames',
    {},
    {
      cacheKey: `getConfig.getAvailableLanguageNames`,
      cacheTtl: CONFIG_REQUEST_CACHE_TTL_SECS,
    }
  );
}
