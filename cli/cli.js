#!/usr/bin/env node

if(process.argv.includes('--proxy')){
  require('../dist/proxy-server');
}
else if(process.argv.includes('--read')){
  require('../dist/read-log');
}
else {
  require('../dist/cli.js');
}

