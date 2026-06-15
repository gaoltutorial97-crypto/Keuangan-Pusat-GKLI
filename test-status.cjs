const http = require('http');

http.get('http://localhost:3000/api/whatsapp/status', res => {
  console.log(`statusCode: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Data:', data));
}).on('error', console.error);
