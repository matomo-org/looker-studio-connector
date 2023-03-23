/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import { beforeAll } from '@jest/globals';
import Clasp from '../utilities/clasp';

// TODO: check this again later
// can't use globalSetup for this, jest has trouble with allowing global setup to be in typescript
beforeAll(async () => Clasp.push());
