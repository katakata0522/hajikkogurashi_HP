'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { plan, publicChanges } = require('./plan-deployment.cjs');

const repo = 'example/site';
const prior = 'a'.repeat(40);
const head = 'b'.repeat(40);
const env = { GITHUB_REPOSITORY: repo, GITHUB_RUN_NUMBER: '9', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_EVENT_NAME: 'push', GITHUB_SHA: head };
const success = { id: 82, run_number: 8, run_attempt: 2, path: '.github/workflows/deploy.yml',
  head_repository: { full_name: repo }, head_branch: 'main', event: 'push',
  status: 'completed', conclusion: 'success' };
const receipt = { name: 'hp-verified-v1-2-' + prior, expired: false, size_in_bytes: 180 };

function fixture({ runs = [success], artifacts = [receipt], total = artifacts.length,
                   main = head, live = prior, changed = () => false } = {}) {
  const api = route => {
    if (route.endsWith('/git/ref/heads/main')) return { object: { sha: main } };
    if (route.includes('/workflows/deploy.yml/runs?')) return { workflow_runs: runs };
    assert.match(route, /\/runs\/82\/artifacts\?/);
    return { artifacts, total_count: total };
  };
  return { api, readLive: async () => live, changed };
}

test('確認済みの公開版を引き継ぎ、手順書だけのmainを公開済みとは記録しない', async () => {
  const decision = await plan(env, fixture({ changed: (from, to) => {
    assert.equal(from, prior);
    assert.equal(to, head);
    return false;
  }}));
  assert.equal(decision.mode, 'unchanged');
  assert.equal(decision.verified, prior);
  assert.equal((await plan(env, fixture({ changed: () => true }))).mode, 'deploy');
});

test('失敗・中断・検証中は、転送途中で版表示が変わり次が文書だけでも再配信する', async () => {
  for (const changes of [{ conclusion: 'failure' }, { conclusion: 'cancelled' }, { status: 'in_progress' },
    { run_number: 6 }, { head_repository: { full_name: 'other/site' } }, { path: 'other.yml' }]) {
    const decision = await plan(env, fixture({ runs: [{ ...success, ...changes }], live: head }));
    assert.equal(decision.mode, 'deploy');
    assert.equal(decision.verified, head);
  }
});

test('証跡の欠落・期限切れ・実行回違い・曖昧さ・本番版の相違では省略しない', async () => {
  for (const fields of [{ runs: [] }, { artifacts: [] }, { artifacts: [{ ...receipt, expired: true }] },
    { artifacts: [{ ...receipt, name: 'hp-verified-v1-1-' + prior }] }, { artifacts: [receipt, receipt] },
    { artifacts: [{ ...receipt, size_in_bytes: 0 }] }, { total: 101 }, { live: head }]) {
    assert.equal((await plan(env, fixture(fields))).mode, 'deploy');
  }
  const broken = () => { throw new Error('unavailable'); };
  for (const deps of [{ ...fixture(), readLive: broken }, fixture({ changed: broken })]) {
    assert.equal((await plan(env, deps)).mode, 'deploy');
  }
  await assert.rejects(plan(env, { api: broken }), /unavailable/);
});

test('手動・再実行は最新mainのみ配信し、古い実行は証跡も作らない', async () => {
  for (const overrides of [{}, { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_RUN_ATTEMPT: '2' }]) {
    const stale = await plan({ ...env, ...overrides }, fixture({ main: prior }));
    assert.equal(stale.mode, 'superseded');
    assert.equal(stale.verified, undefined);
  }
  for (const overrides of [{ GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_RUN_ATTEMPT: '2' }]) {
    assert.equal((await plan({ ...env, ...overrides }, fixture())).mode, 'deploy');
  }
});

test('実際のGit履歴で公開差分、後続文書、削除、拡張子の大文字を区別する', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'hp-deploy-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '--quiet');
  const commit = () => {
    git('add', '-A');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'fixture');
    return git('rev-parse', 'HEAD');
  };
  writeFileSync(join(cwd, 'index.html'), 'first');
  const a = commit();
  writeFileSync(join(cwd, 'index.html'), 'second');
  const b = commit();
  writeFileSync(join(cwd, 'README.md'), 'operator notes');
  const c = commit();
  assert.equal(publicChanges(a, c, cwd), true);
  assert.equal(publicChanges(b, c, cwd), false);
  assert.throws(() => publicChanges(c, a, cwd));
  writeFileSync(join(cwd, 'published.MD'), 'public on Linux');
  const d = commit();
  assert.equal(publicChanges(c, d, cwd), true);
  rmSync(join(cwd, 'index.html'));
  assert.equal(publicChanges(d, commit(), cwd), true);
});
