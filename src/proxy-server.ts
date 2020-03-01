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

const waiting = new LinkedQueue<()=>void>();

process.on('uncaughtException', e => {
  log.error('process uncaught exception:', e);
});

process.on('unhandledRejection', e => {
  log.error('process unhandled rejection:', e);
});

const cache = {
  state: 'DEAD'
};

process.stdin.resume()
  .pipe(new JSONParser())
  .on('error', e => {
    log.warn('json parse error:', e)
  })
  .on('data', d => {
    if(d && d.value && d.value.state === 'LIVE'){
      cache.state = 'LIVE';
      waiting.forEach(v => {
        console.log('value:', v);
        v.value();
      });
    }
    else if(d && d.value && d.value.state === 'DEAD'){
      cache.state = 'DEAD'
    }
    else {
      log.warn('The following is unrecognized info:');
    }
    log.info(d);
  });

const proxy = httpProxy.createProxyServer({target:'http://localhost:2020'}); // See (†)


const s = http.createServer((req, res) => {

  console.log('got a request, state:', cache);

  // res.end('foo');
  //
  // return;

  // return proxy.web(req,res);

  const z = () => {

    // res.end('foo');
    //
    // return;

    const r = http.request({
      method: req.method,
      headers: req.headers,
      path: req.url,
      port: 2020,
      hostname: 'localhost',
      protocol: 'http:',
    }, r => {
      for(const [k,v] of Object.entries(r.headers)){
        res.setHeader(k,v as any);
      }
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

  // throw 'waiting'
  waiting.push(z);

});


s.on('error', e => {
  log.error(e);
});

s.listen(2021, () => {
  log.info('')
});
