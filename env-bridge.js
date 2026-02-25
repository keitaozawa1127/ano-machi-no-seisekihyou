// Environment Bridge Script
// Sets HOME before any Playwright operations
process.env.HOME = process.env.USERPROFILE || 'C:\\Users\\kozaw';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.USERPROFILE + '\\.cache\\ms-playwright';

console.log('HOME:', process.env.HOME);
console.log('PLAYWRIGHT_BROWSERS_PATH:', process.env.PLAYWRIGHT_BROWSERS_PATH);
console.log('Environment set successfully');
