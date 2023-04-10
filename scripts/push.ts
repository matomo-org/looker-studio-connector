/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import chalk from 'chalk';
import Clasp from '../tests/utilities/clasp';
import { execSync } from 'child_process';

async function main() {
  console.log('Building...');
  execSync('npm run build');

  // push via clasp
  console.log('Push...');
  await Clasp.push();

  // get deployment ids
  const deployments = await Clasp.deployments();

  // find HEAD deployment ID
  const headDeploymentId = deployments['HEAD'];
  if (!headDeploymentId) {
    throw new Error('cannot find HEAD deployment ID! (this is unexpected)')
  }

  // construct link for testing w/ looker studio
  const lookerStudioLink = `https://lookerstudio.google.com/datasources/create?connectorId=${headDeploymentId}`;
  console.log('Use the connector with:', chalk.blueBright(lookerStudioLink));
}

main();
