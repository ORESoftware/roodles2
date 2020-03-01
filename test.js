const fs = require('fs');
const path = require('path');

const f = path.resolve(__dirname + '/test/dist/first.js');
const w = fs.watchFile(f, {interval:40}, function(){
  console.log('hello2:', ...arguments);
});

w.on('change', p => {
  console.log('change to:', p);
});
