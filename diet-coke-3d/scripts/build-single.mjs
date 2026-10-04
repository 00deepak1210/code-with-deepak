// Folds the production build (dist/) into one self-contained HTML file that
// runs straight from disk: double-click it, no server or installs needed.
// Browsers refuse to load external module scripts from file://, so the JS,
// the CSS and every font are embedded in the page itself.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'dist-single');
const outFile = join(outDir, 'diet-coke-3d.html');

const MIME = { woff2: 'font/woff2', woff: 'font/woff', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg' };
const dataUri = (file) => {
  const type = MIME[file.split('.').pop()];
  if (!type) throw new Error(`No MIME type for ${file}`);
  return `data:${type};base64,${readFileSync(file).toString('base64')}`;
};

let html = readFileSync(join(dist, 'index.html'), 'utf8');

// Stylesheets → <style>, with the fonts they reference embedded
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  const cssPath = join(dist, href);
  const css = readFileSync(cssPath, 'utf8').replace(/url\(([^)]+)\)/g, (match, url) => {
    const clean = url.replace(/["']/g, '');
    if (clean.startsWith('data:') || clean.startsWith('#')) return match;
    return `url(${dataUri(join(dirname(cssPath), clean))})`;
  });
  return `<style>${css}</style>`;
});

// Module script → inline (escaped so the HTML parser can't end it early)
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  const js = readFileSync(join(dist, src), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return `<script type="module">${js}</script>`;
});

html = html.replace(/href="\.\/favicon\.svg"/, () => `href="${dataUri(join(dist, 'favicon.svg'))}"`);

if (/(src|href)="\.\/(assets\/|[^"]+\.(js|css))/.test(html)) {
  throw new Error('Some assets were not inlined');
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html);
console.log(`Wrote ${outFile} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
