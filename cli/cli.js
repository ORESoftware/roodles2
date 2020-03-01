#!/usr/bin/env node

if(process.argv.includes('--proxy')){
  require('../dist/proxy-server');
}
else {
  require('../dist/cli.js');
}

