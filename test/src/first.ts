#!/usr/bin/env node

import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as assert from 'assert';
import * as EE from 'events';
import * as strm from "stream";

console.log('dog');

const s = http.createServer((req,res) => {
    res.end('hi');
});

console.log('bop');

const port = 3000;

s.listen(port, () => {
  console.log('Listening on port:', port)
});
