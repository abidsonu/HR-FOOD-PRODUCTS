const dns = require('dns');

dns.resolveSrv(
  '_mongodb._tcp.hrfood.aoo6u4l.mongodb.net',
  (err, records) => {
    if (err) {
      console.error('DNS Error:', err);
    } else {
      console.log(records);
    }
  }
);