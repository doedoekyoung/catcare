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

// Copy static public assets (logo, favicons, etc.) from web/ to dist/
const webDir = path.join(__dirname, '..', 'web');
const distDir = path.join(__dirname, '..', 'dist');
for (const name of fs.readdirSync(webDir)) {
  if (name === 'index.html') continue;
  const src = path.join(webDir, name);
  const dest = path.join(distDir, name);
  if (fs.statSync(src).isFile()) {
    fs.copyFileSync(src, dest);
    console.log(`postbuild: copied web/${name} -> dist/${name}`);
  }
}
