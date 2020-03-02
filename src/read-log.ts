'use strict';

import net = require('net');
import {pt} from 'prepend-transform'
import * as chalk from 'chalk';

// clear screen
process.stdout.write('\x1Bc');


{

  const metaConn = net.createConnection('/tmp/cp.api.meta.sock');

  metaConn.on('connect', () => {
    console.log('meta connected');
  });

  metaConn.on('error', e => {
    console.error('meta conn error:', e);
  });

  metaConn.on('data', d => {
    if(String(d).trim() === 'clear'){
      console.log('clearing the screen.');
      process.stdout.write('\x1Bc');
      console.log('new proc starting..');
      return;
    }

    if(String(d).trim() === 'crashed'){
      console.log('proc crashed, waiting for restart.');
      return;
    }

    console.log('message from roodles:', String(d).trim());

  });

}


{

  const stdoutSockFile = '/tmp/cp.api.stdout.sock';
  const readStdoutConn = net.createConnection(stdoutSockFile);

  readStdoutConn.on('connect', () => {
    console.log('connected');
  });

  readStdoutConn.on('error', e => {
    console.error('conn error:', e);
  });

  readStdoutConn
    .pipe(pt(chalk.blueBright(stdoutSockFile) + ': '))
    .pipe(process.stdout);
}


{

  const stderrSockFile = '/tmp/cp.api.stderr.sock';

  const readStderrConn = net.createConnection(stderrSockFile);

  readStderrConn.on('connect', () => {
    console.log('connected');
  });

  readStderrConn.on('error', e => {
    console.error('conn error:', e);
  });

  readStderrConn
    .pipe(pt(chalk.magenta(stderrSockFile) + ': '))
    .pipe(process.stdout);

}

