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

  metaConn.on('error', e => {
    console.error('meta conn error:', e);
  });

  metaConn.on('data', d => {
    if(String(d).trim() === 'clear'){
      log.info('clearing the screen.');
      process.stdout.write('\x1Bc');
      log.info('new proc starting..');
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

  readStdoutConn.on('error', e => {
    console.error('conn error:', e);
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

  readStderrConn.on('error', e => {
    console.error('conn error:', e);
  });

  readStderrConn
    .pipe(pt(chalk.magenta(stderrSockFile) + ': '))
    .pipe(process.stdout);
}

