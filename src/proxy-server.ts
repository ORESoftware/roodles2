#!/usr/bin/env node

//core
import * as cp from 'child_process'
import fs = require('fs');
import path = require('path');
import util = require('util');
import assert = require('assert');
import * as http from 'http';
import {JSONParser} from "@oresoftware/json-stream-parser";
import {LinkedQueue} from "@oresoftware/linked-queue";
import log from './logging';
import httpProxy = require('http-proxy');
import * as utils from './utils';

const waiting = new LinkedQueue<()=>void>();

process.on('uncaughtException', e => {
  log.error('process uncaught exception:', e);
});

process.on('unhandledRejection', e => {
  log.error('process unhandled rejection:', e);
});

const cache = {
  state: 'DEAD' as 'DEAD' | 'LIVE'
};

process.stdin.resume().on('data', d => {
  console.log('raw data from producer:', String(d));
});

process.stdin.resume()
  .pipe(new JSONParser())
  .on('error', e => {
    log.warn('json parse error:', e)
  })
  .on('data', d => {
    if(d && d.value && d.value.state === 'LIVE'){
      cache.state = 'LIVE';
      waiting.forEach(v => {
        // console.log('value:', v); //
        v.value();
      });
    }
    else if(d && d.value && d.value.state === 'DEAD'){
      cache.state = 'DEAD'
    }
    else {
      log.info('The following is unrecognized info:', d);
    }
    log.info(d);
  });

const proxy = httpProxy.createProxyServer({target:'http://localhost:2020'}); // See (†)

const proxyPortRaw = utils.mustGetEnvVar('roodles_proxy_port');

try{
  var proxyPortValue = parseInt(proxyPortRaw);
  assert.strict(Number.isInteger(proxyPortValue), 'proxy port needs to be an integer.');
}
catch(err){
  log.error(`Could not parse integer from env var, value was: '${proxyPortRaw}' ..`);
  process.exit(1);
}


const targetPortRaw = utils.mustGetEnvVar('roodles_target_port');

try{
  var targetPortValue = parseInt(targetPortRaw);
  assert.strict(Number.isInteger(targetPortValue), 'target port needs to be an integer.');
}
catch(err){
  log.error(`Could not parse integer from env var, raw value was: '${targetPortRaw}' ..`);
  process.exit(1);
}

const s = http.createServer((req, res) => {

  console.log('got a request, state:', cache);
  // console.log('req headers:', req.headers);

  console.log('req method:', req.method);
  // Access-Control-Request-Headers

  // res.Header().Set("Access-Control-Allow-Origin", origin)
  // res.Header().Set("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,PATCH")
  // if custHead != "" {
  //   res.Header().Set("Access-Control-Allow-Headers", custHead)
  // } else {
  //   res.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept")
  // }
  // res.Header().Set("Access-Control-Expose-Headers", "Content-Type, Results-Count, Query-Skip, Query-Limit, Next-Set, Prev-Set, Content-Length")
  // res.Header().Set("Access-Control-Allow-Credentials", "true")
  // res.Header().Set("Access-Control-Max-Age", "3600")

  // if(String(req.method|| '').toUpperCase() === 'OPTIONS'){
  //   res.setHeader('Access-Control-Expose-Headers', '*');
  //   res.setHeader('Access-Control-Allow-Credentials', 'true');
  //   res.setHeader('Access-Control-Max-Age', '3600');
  //   res.setHeader('Access-Control-Allow-Origin', '*');
  //   res.setHeader('Access-Control-Allow-Headers', '*');
  //   res.setHeader('Access-Control-Allow-Methods', '*');
  //   res.setHeader('Connection', 'keep-alive');
  //   res.setHeader('Access-Control-Request-Method', 'POST');
  //   res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  //   res.setHeader('Allowed', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  //   return res.writeHead(200);
  // }

  // if(String(req.method|| '').toUpperCase() !== 'OPTIONS') {
  //   if(req.headers['origin'] === 'localhost' || req.headers['Origin'] === 'localhost'){
  //     res.setHeader('Access-Control-Allow-Origin', '*');
  //     res.setHeader('Access-Control-Allow-Headers', '*');
  //     res.setHeader('Access-Control-Allow-Methods', '*');
  //     log.info('allow access to all origins.')
  //   }
  //   else{
  //     // log.warn('Could not set access control allow all header.')
  //     res.setHeader('Access-Control-Allow-Origin', '*');
  //     res.setHeader('Access-Control-Allow-Headers', '*');
  //     res.setHeader('Access-Control-Allow-Methods', '*')
  //   }
  // }


  const z = () => {

    if(res.finished){
      log.warn('response was already finished? original request was to:', req.url);
      return;
    }

    proxy.web(req,res);
  };

  const m = () => {

    if(res.finished){
      log.warn('response was already finished? original request was to:', req.url);
      return;
    }

    const r = http.request({
      method: req.method,
      headers: req.headers,
      path: req.url,
      port: targetPortValue,
      hostname: 'localhost',
      protocol: 'http:',
    }, r => {
      // for(const [k,v] of Object.entries(r.headers)){
      //   res.setHeader(k,v as any);
      // }
      r.pipe(res)
    });

    r.on('error', e => {
      log.warn('request error:', e);
    });

    req.pipe(r);
  };

  if(cache.state === 'LIVE'){
    return z();
  }

  res.setHeader('roodles_waiting', JSON.stringify({value: true}));
  // throw 'waiting'
  waiting.push(z);

});


s.on('error', e => {
  log.error(e);
});


s.listen(proxyPortValue, '0.0.0.0', () => {
  log.info(
    'roodles proxy-server is listening on port:', proxyPortValue,
    'and forwarding requests to port:', targetPortValue
  );
});


// s.listen(2021, () => {
//   log.info(
//     'roodles proxy-server is listening on port:', 2021,
//     'and forwarding requests to port:', 2020
//   );
// });
