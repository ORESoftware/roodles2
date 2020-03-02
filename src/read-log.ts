'use strict';

import net = require('net');
import {pt} from 'prepend-transform'
import * as chalk from 'chalk';
import * as utils from './utils';
import log from './logging';

// clear screen
process.stdout.write('\x1Bc');

process.stdin.resume().on('data', d => {
  if(String(d || '').trim().toLowerCase() === 'clear'){
    log.info('clearing the screen..');
    process.stdout.write('\x1Bc');
  }
});

{
  const metaSock = utils.mustGetEnvVar('roodles_meta_sock');  // '/tmp/cp.api.meta.sock'
  const metaConn = net.createConnection(metaSock);

  metaConn.on('connect', () => {
    log.info('meta connected');
  });

  metaConn.once('end', () => {
    log.warn('meta stream ended.');
    process.exit(0)
  });

  metaConn.on('error', e => {
   log.error('meta conn error:', e);
    process.exit(0);
  });

  metaConn.on('data', d => {

    if(String(d).trim() === 'clear'){
      log.info('clearing the screen.');
      process.stdout.write('\x1Bc');
      log.info('new proc starting..');
      return;
    }

    if(String(d).trim() === 'restarting'){
      log.info('clearing the screen.');
      process.stdout.write('\x1Bc');
      log.info('new proc starting soon..');
      return;
    }

    if(String(d).trim() === 'crashed'){
      log.info('proc crashed, waiting for restart.');
      return;
    }

    log.info('message from roodles:', String(d).trim());

  });

}


{
  // const stdoutSockFile = '/tmp/cp.api.stdout.sock';
  const stdoutSockFile = utils.mustGetEnvVar('roodles_stdout_sock');  // '/tmp/cp.api.stdout.sock'
  const readStdoutConn = net.createConnection(stdoutSockFile);

  readStdoutConn.on('connect', () => {
    log.info('stdout pipe connected');
  });

  readStdoutConn.once('end', () => {
    log.warn('stdout stream ended.');
    process.exit(0)
  });

  readStdoutConn.on('error', e => {
   log.error('conn error:', e);
    process.exit(0);
  });

  readStdoutConn
    .pipe(pt(chalk.blueBright(stdoutSockFile) + ': '))
    .pipe(process.stdout);
}


{
  // const stderrSockFile = '/tmp/cp.api.stderr.sock';
  const stderrSockFile = utils.mustGetEnvVar('roodles_stderr_sock');
  const readStderrConn = net.createConnection(stderrSockFile);

  readStderrConn.on('connect', () => {
    log.info('stderr pipe connected');
  });

  readStderrConn.once('end', () => {
    log.warn('stderr stream ended.');
    process.exit(0)
  });

  readStderrConn.once('error', e => {
   log.error('conn error:', e);
    process.exit(0)
  });

  readStderrConn
    .pipe(pt(chalk.magenta(stderrSockFile) + ': '))
    .pipe(process.stdout);
}

