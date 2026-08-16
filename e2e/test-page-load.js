const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Loading login page...');
  await page.goto('http://localhost:5177/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  await page.waitForSelector('input[type="tel"]', { timeout: 10000 });
  
  const classes = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const withClass = all.filter(el => el.className && typeof el.className === 'string' && el.className.trim().length > 0);
    return withClass.slice(0, 30).map(el => el.className);
  });
  
  console.log('\nClasses found:', classes);
  
  await browser.close();
})();
