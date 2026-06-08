const bcrypt = require('bcryptjs');

bcrypt.hash('test123', 10).then(hash => {
  console.log(hash);
});
