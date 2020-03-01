'use strict';

import * as chalk from "chalk";

const isDebug = process.env.roodles_is_debug === 'yes';

export const log = {
  newline: console.log.bind(console, '\n'),
  info: console.log.bind(console),
  warning: console.error.bind(console, chalk.bold.yellow.bold('roodles warn:')),
  warn: console.error.bind(console, chalk.bold.magenta.bold('roodles warn:')),
  error: console.error.bind(console, chalk.redBright.bold('roodles error:')),
  debug (...args: any[]) {
    isDebug && console.log(chalk.yellow.bold('roodles debug:'), ...arguments);
  }
};

export default log;
