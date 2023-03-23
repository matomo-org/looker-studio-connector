/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import * as path from 'path';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as chalk from 'chalk';

interface RunOptions {
  passthrough?: boolean;
}

class Clasp {
  private claspPath: string;

  constructor() {
    this.claspPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'clasp');

    if (!fs.existsSync(this.claspPath)) {
      throw new Error(`Cannot find 'clasp' bin! (Looking in: ${this.claspPath}})`);
    }
  }

  async push() {
    return this.runExecutable('push -f', { passthrough: true });
  }

  async run(functionName: string, ...args: any[]) {
    const params = `-p "${JSON.stringify([...args, true])}"`
    return this.runExecutable(`run ${params} ${functionName}`);
  }

  async runExecutable(subcommand: string, options: RunOptions = {}) {
    const command = `${this.claspPath} ${subcommand}`;

    if (options.passthrough) {
      process.stdout.write(chalk.yellow(`Running '${command}':\n`));
    }

    return new Promise((resolve, reject) => {
      try {
        const proc = exec(command);

        let output = '';

        proc.stdout.on('data', (data: Buffer) => {
          if (options.passthrough) {
            process.stdout.write(data);
          } else {
            output += data.toString('utf-8');
          }
        });

        proc.stderr.on('data', (data) => {
          process.stderr.write(data);
        });

        proc.on('close', (code) => {
          if (options.passthrough) {
            process.stdout.write("\n");
          }

          if (code) {
            reject(new Error(`${command} exited with code ${code}`));
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
            try {
              parsedOutput = JSON.parse(cleanOutput);
            } catch (e) {
              // ignore
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
