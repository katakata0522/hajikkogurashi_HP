import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected window.open snippet not found`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${path}: expected window.open snippet is not unique`);
  }
  writeFileSync(path, source.slice(0, first) + after + source.slice(first + before.length), 'utf8');
}

replaceOnce(
  'assets/js/main.js',
`\t\t\t\t\t\t\tif (link.getAttribute('target') === '_blank') {
\t\t\t\t\t\t\t\twindow.open(href);
\t\t\t\t\t\t\t} else {`,
`\t\t\t\t\t\t\tif (link.getAttribute('target') === '_blank') {
\t\t\t\t\t\t\t\tvar opened = window.open(href, '_blank', 'noopener,noreferrer');
\t\t\t\t\t\t\t\tif (opened) opened.opener = null;
\t\t\t\t\t\t\t} else {`
);

replaceOnce(
  'girigiri-brake/script.js',
`        window.open(\`https://twitter.com/intent/tweet?text=\${encodeURIComponent(text)}&url=\${encodeURIComponent(url)}&hashtags=\${encodeURIComponent(hashtags)}\`);`,
`        const shareWindow = window.open(\`https://twitter.com/intent/tweet?text=\${encodeURIComponent(text)}&url=\${encodeURIComponent(url)}&hashtags=\${encodeURIComponent(hashtags)}\`, '_blank', 'noopener,noreferrer');
        if (shareWindow) shareWindow.opener = null;`
);

console.log('Applied noopener protection to the two diagnosed runtime popup paths.');
