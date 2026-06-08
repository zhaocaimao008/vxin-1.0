const http = require('http');
const bcrypt = require('bcryptjs');

async function main() {
  const hash = await bcrypt.hash('test123', 10);
  
  // We'll update password and login via SQLite through shell
  console.log('Hash:', hash);
}
main();
