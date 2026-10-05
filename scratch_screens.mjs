import fs from 'fs';
const content = fs.readFileSync('tpi-redesign.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('id="screen-')) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
