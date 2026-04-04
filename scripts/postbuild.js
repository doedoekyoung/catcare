const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

let html = fs.readFileSync(indexPath, 'utf-8');

// Add translate="no" to <html> tag
html = html.replace(/<html([^>]*)>/, (match, attrs) => {
  if (attrs.includes('translate=')) return match;
  return `<html${attrs} translate="no">`;
});

// Add <meta name="google" content="notranslate"> in <head>
if (!html.includes('content="notranslate"')) {
  html = html.replace('<head>', '<head>\n    <meta name="google" content="notranslate" />');
}

fs.writeFileSync(indexPath, html, 'utf-8');
console.log('postbuild: injected notranslate into dist/index.html');
