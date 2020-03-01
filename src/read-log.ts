'use strict';

import net = require('net');
import {pt} from 'prepend-transform'

// clear screen
process.stdout.write('\x1Bc');

const sockFile = '/tmp/cp.api.sock';

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


const readConn = net.createConnection(sockFile);

readConn.on('connect', () => {
  console.log('connected');
});

readConn.on('error', e => {
  console.error('conn error:', e);
});

readConn.pipe(pt(sockFile + ':')).pipe(process.stdout);
