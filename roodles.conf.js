'use strict';

const path = require('path');

module.exports = {
  exec: 'node test/dist/first.js',
  portsUsed: [],
  signal: 'SIGINT',
  processArgs: ['--foo', 'bar', '--baz', 'bam'],
  restartUponChanges: true,
  restartUponAdditions: true,
  restartUponUnlinking: true,
  processLogPath: null,
  include: path.resolve(__dirname + '/test/dist/first.js')
};
