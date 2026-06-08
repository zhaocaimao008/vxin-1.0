const bcrypt = require('bcryptjs');
const fs = require('fs');

bcrypt.hash('test123', 10).then(hash => {
  fs.writeFileSync('/tmp/bcrypt_hash.txt', hash);
  console.log('Hash written to /tmp/bcrypt_hash.txt');
});
