/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { ReadableStream as ReadableStreamWeb } from 'stream/web';
import { finished } from 'stream/promises';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getGithubToken() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error('No github token found. Create one that has the "actions" scope, and set it as the '
      + 'GITHUB_TOKEN environment variable either in your shell or in the root .env file.')
  }

  return process.env.GITHUB_TOKEN;
}

async function main() {
  const githubToken = getGithubToken();

  // pick build to use
  const artifactsApiUrl = 'https://api.github.com/repos/matomo-org/looker-studio-connector/actions/artifacts?per_page=100';
  const response = await (await fetch(artifactsApiUrl)).json();

  const builds = new Set<string>();
  response.artifacts.forEach((artifactInfo) => {
    const buildId = artifactInfo.workflow_run.id;
    const branchName = artifactInfo.workflow_run.head_branch;

    builds.add(`${branchName} (workflow run ${buildId})`);
  });
  console.log(builds);

  const answers = await inquirer.prompt([
    {
      name: 'build',
      message: 'Pick a build to download artifacts from',
      choices: Array.from(builds.values()),
      type: 'list',
    },
  ]);

  const buildId = parseInt(/workflow run ([^)]+)\)/.exec(answers.build)[1], 10);
  const artifactId = response.artifacts.find((a) => a.workflow_run.id === buildId).id;

  // download artifact
  console.log('Downloading...');
  const artifactUrl = `https://api.github.com/repos/matomo-org/looker-studio-connector/actions/artifacts/${artifactId}/zip`;

  if (fs.existsSync(`${artifactId}.zip`)) {
    fs.unlinkSync(`${artifactId}.zip`);
  }

  const stream = fs.createWriteStream(`${artifactId}.zip`);
  const { body } = await fetch(artifactUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  await finished(Readable.fromWeb(body as ReadableStreamWeb<any>).pipe(stream));

  // extract artifact
  console.log('Extracting...');
  const actualFolderPath = path.join(__dirname, '..', 'tests', 'appscript', 'actual');
  fs.rmSync(actualFolderPath, {
    recursive: true,
    force: true,
  });

  execSync(`unzip -o ${artifactId}.zip -d ${actualFolderPath}`);

  fs.rmSync(`${artifactId}.zip`);

  console.log('Done.');
}

main()
  .catch((e) => {
    console.log(`Failed: ${e.stack}`);
    process.exit(1);
  });
