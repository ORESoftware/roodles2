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

  metaConn.once('error', e => {
   log.error("e6bb3525-3e78-4a29-96dc-396a3324bb10", 'meta conn error:', e);
    process.exit(0);
  });

  metaConn.on('data', d => {

    if(String(d || '').trim() === 'clear'){
      log.info('clearing the screen.');
      process.stdout.write('\x1Bc');
      log.info('new proc starting..');
      return;
    }

    if(String(d || '').trim() === 'restarting'){
      log.info('clearing the screen.');
      process.stdout.write('\x1Bc');
      log.info('new proc starting soon..');
      return;
    }

    if(String(d || '').trim() === 'crashed'){
      log.info("92832e61-4055-488f-bc29-f63304731f17", 'proc crashed, waiting for restart.');
      return;
    }

    log.info('message from roodles:', String(d || '').trim());

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
    log.warn("250bcc06-09d3-44e7-abc2-7131955dbe44", 'stdout stream ended.');
    process.exit(0)
  });

  readStdoutConn.on('error', e => {
   log.error("2199249b-f4ff-4302-9b8c-338c0e93fdb4", 'conn error:', e);
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
    log.warn("d2ccdc38-c548-49db-b764-c67dfb02b6da", 'stderr stream ended.');
    process.exit(0)
  });

  readStderrConn.once('error', e => {
   log.error("37106b08-55d2-41d0-a8b2-6262c02fedc6", 'conn error:', e);
    process.exit(0)
  });

  readStderrConn
    .pipe(pt(chalk.magenta(stderrSockFile) + ': '))
    .pipe(process.stdout)
    .on('error', e => {
       log.error("4fb83c08-c1fd-4951-83b2-e07cea34022a", e)
    })
}

