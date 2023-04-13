/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';
import chalk from 'chalk';

interface RunOptions {
  passthrough?: boolean;
  textOutput?: boolean;
}

class Clasp {
  private claspPath: string;
  private logWatchProc: ReturnType<typeof spawn>|null = null;

  constructor() {
    this.claspPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'clasp');

    if (!fs.existsSync(this.claspPath)) {
      throw new Error(`Cannot find 'clasp' bin! (Looking in: ${this.claspPath}})`);
    }
  }

  startWatchingLogs() {
    this.logWatchProc = spawn(this.claspPath, ['logs', '--watch']);

    this.logWatchProc.stdout.on('data', (data: Buffer) => {
      let dataWithoutTimestamp = data.toString('utf-8');
      dataWithoutTimestamp = dataWithoutTimestamp.replace(/timestamp >= "[^"]+?"\n?/g, '');
      process.stdout.write(chalk.blueBright(dataWithoutTimestamp));
    });
  }

  stopWatchingLogs() {
    if (this.logWatchProc) {
      this.logWatchProc.kill();
    }
  }

  async deploy() {
    await this.push();

    return this.runExecutable(['deploy']);
  }

  async deployments() {
    const output = await this.runExecutable<string>(['deployments'], { textOutput: true });
    const lines = (output as string).split("\n");

    const deployments: Record<string, string> = {};
    lines.forEach((line) => {
      const m = line.match(/-\s+(\S+)\s+@(\S+)/);
      if (!m) {
        return;
      }

      const deploymentId = m[1];
      const version = m[2];
      deployments[version] = deploymentId;
    });

    return deployments;
  }

  async push() {
    return this.runExecutable(['push', '-f'], { passthrough: true });
  }

  async run(functionName: string, ...args: any[]) {
    return this.runExecutable(['run', '-p', JSON.stringify([functionName, ...args]), 'callFunctionInTest']);
  }

  async setScriptProperties(properties: Record<string, string>) {
    return this.run('setScriptProperties', properties);
  }

  async runExecutable<T = unknown>(subcommand: string[], options: RunOptions = {}): Promise<T|number> {
    const commandStr = `${this.claspPath} ${subcommand.join(' ')}`;

    if (options.passthrough) {
      process.stdout.write(chalk.yellow(`Running '${commandStr}':\n`));
    }

    return new Promise((resolve, reject) => {
      try {
        const proc = spawn(this.claspPath, subcommand);

        let output = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
          if (options.passthrough) {
            process.stdout.write(data);
          } else {
            output += data.toString('utf-8');
          }
        });

        proc.stderr.on('data', (data) => {
          if (options.passthrough) {
            process.stderr.write(data);
          } else {
            stderr += data.toString('utf-8');
          }
        });

        proc.on('close', (code) => {
          if (options.passthrough) {
            process.stdout.write("\n");
          }

          if (code) {
            if (stderr.indexOf('Error: invalid_grant') !== -1) {
              reject(new Error('clasp could not login, run "npm run clasp -- login --creds creds.json" again'));
              return;
            }
            reject(new Error(`'${commandStr}' exited with code ${code} (output: ${output}, stderr: ${stderr})`));
          } else {
            if (options.passthrough) {
              resolve(code);
              return;
            }

            let cleanOutput = output.replace(/^Running in dev mode\./, '').trim();
            if (cleanOutput === 'No response.') {
              resolve(undefined);
              return;
            }

            let parsedOutput: any = cleanOutput;
            if (!options.textOutput) {
              try {
                parsedOutput = JSON.parse(cleanOutput);
              } catch (e) {
                // ignore
              }
            }

            if (parsedOutput.stack) {
              reject(parsedOutput);
              return;
            }

            resolve(parsedOutput);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}

export default new Clasp();
