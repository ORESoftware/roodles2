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

const waiting = new LinkedQueue();

let live = false;

process.stdin.resume()
  .pipe(new JSONParser())
  .on('data', d=> {
    console.log('stdio info:', d);
  });


const s = http.createServer((req,res) => {

  const r = http.request({
    method : req.method,
    headers: req.headers,
    path: req.url,
    port: 2020,
    hostname: 'localhost',
    protocol: 'http:',
  }, r => {
    r.pipe(res)
  });

  req.pipe(r);

});
