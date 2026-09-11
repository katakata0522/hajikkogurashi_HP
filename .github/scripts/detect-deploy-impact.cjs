'use strict';

const fs = require('node:fs');

function normalizePath(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function classifyPath(rawPath) {
  const path = normalizePath(rawPath);

  if (!path) {
    return { path, deploy: false, reason: 'empty' };
  }

  if (path === '..' || path.startsWith('../') || path.includes('/../')) {
    return { path, deploy: true, reason: 'unsafe-path' };
  }

  // Changing the production workflow can alter what is generated or mirrored,
  // so treat it as a deployment input even though .github itself is not public.
  if (path === '.github/workflows/deploy.yml') {
    return { path, deploy: true, reason: 'deployment-workflow' };
  }

  // sitemap.xml is regenerated during Deploy, so this script is a build input.
  if (path === 'scripts/generate-sitemap.ps1') {
    return { path, deploy: true, reason: 'build-input' };
  }

  const excludedExact = new Set([
    '.gitignore',
    '.gitattributes',
    '.gitlab-ci.yml',
    'package.json',
    'package-lock.json',
    'assets/css/custom.dev.css',
  ]);

  if (excludedExact.has(path)) {
    return { path, deploy: false, reason: 'non-public' };
  }

  const excludedPrefixes = [
    '.git/',
    '.github/',
    'scripts/',
    'node_modules/',
    '_codex_screens/',
    'playwright-report/',
    'test-results/',
    'assets/css/components/',
    'assets/js/ie/',
  ];

  if (excludedPrefixes.some((prefix) => path.startsWith(prefix))) {
    return { path, deploy: false, reason: 'non-public' };
  }

  if (/\.(?:md|py)$/i.test(path)) {
    return { path, deploy: false, reason: 'non-public' };
  }

  return { path, deploy: true, reason: 'public-artifact' };
}

function classify(paths) {
  const items = paths.map(classifyPath).filter((item) => item.path);
  return {
    deployNeeded: items.some((item) => item.deploy),
    deploymentPaths: items.filter((item) => item.deploy),
    ignoredPaths: items.filter((item) => !item.deploy),
  };
}

const input = fs.readFileSync(0, 'utf8');
const paths = input.split(/\r?\n/).filter((line) => line.trim());
process.stdout.write(`${JSON.stringify(classify(paths), null, 2)}\n`);
