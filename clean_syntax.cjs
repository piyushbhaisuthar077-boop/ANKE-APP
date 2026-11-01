// clean_syntax.cjs
const fs = require('fs');

let content = fs.readFileSync('index.html', 'utf8');

// Fix window.(window.showAnkeToast || console.log)
content = content.replace(/window\.\(window\.showAnkeToast \|\| console\.log\)/g, 'window.showAnkeToast');

// Fix window.if (window.persistState) window.persistState();
content = content.replace(/window\.if \(window\.persistState\) window\.persistState\(\);/g, 'if (window.persistState) window.persistState();');

fs.writeFileSync('index.html', content, 'utf8');

// Now validate all script tags
const regex = /<script>([\s\S]*?)<\/script>/g;
let m;
let count = 0;
let errors = 0;
while ((m = regex.exec(content)) !== null) {
  count++;
  try {
    new Function(m[1]);
  } catch (err) {
    errors++;
    console.error('Syntax error in script #' + count + ':', err.message);
  }
}

if (errors === 0) {
  console.log('SUCCESS! All ' + count + ' script tags have valid syntax!');
} else {
  console.error('Found ' + errors + ' script errors');
  process.exit(1);
}
