/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

// this script is used to update the repository secrets that allow running clasp
// in github actions. it is run within github actions.
//
// we cannot login to clasp the normal way w/o a web browser, which makes logging in
// within github actions harder. instead, we login locally, then set the oauth
// credentials file as a secret. if the credentials become stale, they will be refreshed
// by clasp. we detect when this happens, and update the secret, so the build can
// continue running w/o a human doing something.

import * as fs from 'fs';
import { Octokit } from 'octokit';
import sodium from 'libsodium-wrappers';

async function main() {
  await sodium.ready;

  const base = 'repos';
  const repo = process.env.GITHUB_REPOSITORY;

  const octokit = new Octokit({ auth: process.env.REPO_TOKEN });

  let publicKeyResponse = await octokit.request(`GET /:base/${repo}/actions/secrets/public-key`, { base });
  const { key_id, key } = publicKeyResponse.data;

  const hasSecretChanged = (secretEnvVarName: string, secretFile: string) => {
    const secretInEnv = process.env[secretEnvVarName];
    const secretInFile = fs.readFileSync(secretFile).toString('utf-8');
    return secretInFile.trim().length && secretInEnv !== secretInFile;
  };

  const saveSecret = async (secretEnvVarName: string, secretFile: string) => {
    console.log(`${secretEnvVarName} secret changed in file, updating repo secret...`);

    const newSecretValue = fs.readFileSync(secretFile);

    const keyBytes = Buffer.from(key, 'base64');
    const encryptedBytes = Buffer.from(sodium.crypto_box_seal(newSecretValue, keyBytes)).toString('base64');

    const response = await octokit.request(`PUT /:base/${repo}/actions/secrets/:name`, {
      base: base,
      name: secretEnvVarName,
      data: {
        encrypted_value: encryptedBytes,
        key_id,
      },
    });

    if (response.status >= 400) {
      console.log('failed to save secret:', response.data);
      return false;
    } else {
      console.log('secret saved successfully');
      return true;
    }
  }

  let secretChangeFailed = false;
  if (hasSecretChanged('CLASP_CREDENTIALS', `${process.env.HOME}/.clasprc.json`)) {
    secretChangeFailed = await !saveSecret('CLASP_CREDENTIALS', `${process.env.HOME}/.clasprc.json`) || secretChangeFailed;
  } else {
    console.log('CLASP_CREDENTIALS has not changed');
  }

  if (hasSecretChanged('CLASP_CREDENTIALS_LOCAL', '.clasprc.json')) {
    secretChangeFailed = await !saveSecret('CLASP_CREDENTIALS_LOCAL', '.clasprc.json') || secretChangeFailed;
  } else {
    console.log('CLASP_CREDENTIALS_LOCAL has not changed');
  }

  return secretChangeFailed ? 1 : 0;
}

main()
  .then((code) => {
    process.exit(code);
  });
