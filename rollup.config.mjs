/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import dotenvModule from 'rollup-plugin-dotenv';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { rollupImportMapPlugin } from 'rollup-plugin-import-map';

const dotenv = dotenvModule.default;

// removes export statements since they are not recognized by apps script, but rollup always puts them in for esm output
const removeExports = () => {
  return {
    name: 'remove-exports',
    renderChunk(code) {
      return code.replace(/export [^;]+?;/g, '');
    },
  };
};

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    name: 'MatomoLookerStudio',
  },
  plugins: [
    rollupImportMapPlugin({
      'imports': {
        'typed-function': '../../node_modules/typed-function/lib/esm/typed-function.mjs',
        'decimal.js': '../../node_modules/decimal.js/decimal.mjs',
        'complex.js': '../../node_modules/complex.js/complex.js',
        'fraction.js': '../../node_modules/fraction.js/fraction.js',
        'javascript-natural-sort': '../../node_modules/javascript-natural-sort/naturalSort.js',
        'escape-latex': '../../node_modules/escape-latex/dist/index.js',
        'seedrandom': '../../node_modules/seedrandom/seedrandom.js',
        'tiny-emitter': '../../node_modules/tiny-emitter/dist/tinyemitter.min.js',
      },
    }),
    nodeResolve(),
    typescript(),
    dotenv(),
    copy({
      targets: [
        { src: 'src/appsscript.json', dest: 'dist' },
      ],
    }),
    removeExports(),
  ],
};
