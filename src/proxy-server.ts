#!/usr/bin/env node

//core
import assert = require('assert');
import * as http from 'http';
import {JSONParser} from "@oresoftware/json-stream-parser";
import {LinkedQueue} from "@oresoftware/linked-queue";
import log from './logging';
import httpProxy = require('http-proxy');
import * as utils from './utils';

const waiting = new LinkedQueue<()=>void>();

process.on('uncaughtException', e => {
  log.error("e580ec9b-9fb2-466c-8caf-8a31ccbf283f", 'process uncaught exception:', e);
});

process.on('unhandledRejection', e => {
  log.error("551cf596-a469-4d29-9c17-44bfd427aa8b", 'process unhandled rejection:', e);
});

const cache = {
  state: 'DEAD' as 'DEAD' | 'LIVE'
};

process.stdin.resume().on('data', d => {
  console.log('raw data from producer:', String(d || '').trim());
});

process.stdin.resume()
  .pipe(new JSONParser())
  .on('error', e => {
    log.warn("3f3550dd-5b4d-4051-916b-704b158d6755", 'json parser error:', e)
  })
  .on('data', d => {
    if(d && d.value && d.value.state === 'LIVE'){
      cache.state = 'LIVE';
      waiting.dequeueEach(v => {
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




const proxyPortRaw = utils.mustGetEnvVar('roodles_proxy_port');

try{
  var proxyPortValue = parseInt(proxyPortRaw);
  assert.strict(Number.isInteger(proxyPortValue), 'proxy port needs to be an integer.');
}
catch(err){
  log.error("36a367e2-ceae-4ec8-a328-3a36ce51a86d", `Could not parse integer from env var, value was: '${proxyPortRaw}' ..`);
  process.exit(1);
}


const targetPortRaw = utils.mustGetEnvVar('roodles_target_port');

try{
  var targetPortValue = parseInt(targetPortRaw);
  assert.strict(Number.isInteger(targetPortValue), 'target port needs to be an integer.');
}
catch(err){
  log.error("3f4840ec-3f13-4d40-bb1d-8896c8767dfa", `Could not parse integer from env var, raw value was: '${targetPortRaw}' ..`);
  process.exit(1);
}

const proxy = httpProxy.createProxyServer({target:`http://localhost:${targetPortRaw}`}); // See (†)

const s = http.createServer((req, res) => {

  res.setHeader("Roodles-Cookie", JSON.stringify({time: new Date().toISOString()}));

  res.once('finish', () => {
    log.info('req url:', req.method, req.url, 'res headers:', res.getHeaders());
  });

  res.once('end', () => {
    log.info('req url:', req.method, req.url, 'res headers:', res.getHeaders());
  });

  console.log('got a request, state:', cache);
  // console.log('req headers:', req.headers);

  console.log('req method:', req.method, req.url);
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
  //   log.info('this is an options request!');
  //   res.setHeader('Access-Control-Expose-Headers', '*');
  //   res.setHeader('Access-Control-Allow-Credentials', 'true');
  //   res.setHeader('Access-Control-Max-Age', '3600');
  //   res.setHeader('Access-Control-Allow-Origin', '*');
  //   res.setHeader('Access-Control-Allow-Headers', '*');
  //   res.setHeader('Access-Control-Allow-Methods', '*');
  //   res.setHeader('Connection', 'keep-alive');
  //   res.setHeader('Access-Control-Request-Method', '*');
  //   res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  //   res.setHeader('Allowed', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
  //   res.setHeader('Content-Length', 0);
  //   res.writeHead(200);
  //   res.end();
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

  // const m = () => {
  //
  //   if(res.finished){
  //     log.warn('response was already finished? original request was to:', req.url);
  //     return;
  //   }
  //
  //   const r = http.request({
  //     method: req.method,
  //     headers: req.headers,
  //     path: req.url,
  //     port: targetPortValue,
  //     hostname: 'localhost',
  //     protocol: 'http:',
  //   }, r => {
  //     // for(const [k,v] of Object.entries(r.headers)){
  //     //   res.setHeader(k,v as any);
  //     // }
  //     r.pipe(res)
  //   });
  //
  //   r.on('error', e => {
  //     log.warn('request error:', e);
  //   });
  //
  //   req.pipe(r);
  // };

  if(cache.state === 'LIVE'){
    // return m();
    return z();
  }

  res.setHeader('roodles_waiting', JSON.stringify({value: true}));
  // throw 'waiting'
  // waiting.push(m);
  waiting.push(z);

});


s.on('error', e => {
  log.error("3c565590-c735-48e0-9108-db6a1e50de8e", e);
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
