/**
 * Matomo - free/libre analytics platform
 *
 * @link https://matomo.org
 * @license http://www.gnu.org/licenses/gpl-3.0.html GPL v3 or later
 */

const typescript = require('@rollup/plugin-typescript');
const copy = require('rollup-plugin-copy');
const dotenv = require('rollup-plugin-dotenv').default;

// removes export statements since they are not recognized by apps script, but rollup always puts them in for esm output
const removeExports = () => {
  return {
    name: 'remove-exports',
    renderChunk(code) {
      return code.replace(/export [^;]+?;/g, '');
    },
  };
};

module.exports = {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'esm',
    name: 'MatomoLookerStudio',
  },
  plugins: [
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
