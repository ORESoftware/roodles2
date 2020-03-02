import * as http from 'http';


const server = http.createServer((req,res) => {

  setTimeout(() => {
    res.setHeader("1st-header", Date.now())
  }, 1000);

  setTimeout(() => {
    res.setHeader("2nd-header", Date.now())
  }, 2000);

  setTimeout(() => {
    res.setHeader("3rd-header", Date.now())
  }, 3000);

  setTimeout(() => {
    res.write(JSON.stringify({val: '1st line of json', time: Date.now()}) + '\n');
  }, 3050);

  setTimeout(() => {
    res.write(JSON.stringify({val: '2nd line of json', time: Date.now()}) + '\n')
  }, 4000);

  setTimeout(() => {
    res.write(JSON.stringify({val: '3rd line of json', time: Date.now()}) + '\n')
  }, 5000);

  setTimeout(() => {
    res.write(JSON.stringify({val: '3rd line of json', time: Date.now()}) + '\n')
    res.end(); // end the response here
  }, 6000);

});


server.listen(5000, 'localhost', () => {

  console.log('Server is listening on port:', 5000);

  // send the one and only request once the server starts listening
  const req = http.request({
    method:'GET',
    hostname:'localhost',
    protocol:'http:',
    port: 5000,
    path: '/',
  }, res => {

    console.log(res.headers);

    res.on('header', (a,b) => {
       console.log('header:', a, b);
    });

    res.on('data', d => {
        console.log('data:', JSON.parse(d), 'at time:', Date.now());
    })

  });

  req.end();


});
