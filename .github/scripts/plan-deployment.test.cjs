'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { plan, publicChanges } = require('./plan-deployment.cjs');
const { classify } = require('./detect-deploy-impact.cjs');

const repo = 'example/site';
const prior = 'a'.repeat(40);
const head = 'b'.repeat(40);
const env = { GITHUB_REPOSITORY: repo, GITHUB_RUN_NUMBER: '9', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_EVENT_NAME: 'push', GITHUB_SHA: head };
const success = { id: 82, run_number: 8, run_attempt: 2, path: '.github/workflows/deploy.yml',
  head_repository: { full_name: repo }, head_branch: 'main', event: 'push',
  status: 'completed', conclusion: 'success' };
const receipt = { name: 'hp-verified-v1-2-' + prior, expired: false, size_in_bytes: 180 };
const candidateRun = { id: 93, run_attempt: 2, path: '.github/workflows/dry-run.yml', head_sha: head,
  head_repository: { full_name: repo }, head_branch: 'verified/release', event: 'push',
  status: 'completed', conclusion: 'success' };
const staticRuntime = '1'.repeat(64);
const publicDigest = '2'.repeat(64);
const passingChecks = { name: `hp-regressions-v2-2-${head}-${staticRuntime}-${publicDigest}`,
  expired: false, size_in_bytes: 210 };

function fixture({ runs = [success], artifacts = [receipt], total = artifacts.length,
                   candidates = [], checks = [], checkTotal = checks.length,
                   main = head, live = prior, changed = () => false } = {}) {
  const requests = [];
  const api = (route, filter) => {
    requests.push(route);
    if (route.endsWith('/git/ref/heads/main')) return { object: { sha: main } };
    if (route.includes('/workflows/deploy.yml/runs?')) {
      assert.match(filter, /select\(\.run_number == 8\)/);
      return runs;
    }
    if (route.includes('/workflows/dry-run.yml/runs?')) {
      assert.ok(route.includes('event=push') && route.includes('head_sha=' + head));
      return candidates;
    }
    if (route.includes('/runs/93/artifacts?')) return { artifacts: checks, total_count: checkTotal };
    assert.match(route, /\/runs\/82\/artifacts\?/);
    return { artifacts, total_count: total };
  };
  return { api, readLive: async () => live, changed, requests };
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
  for (const fields of [{ runs: [] }, { runs: [success, success] }, { artifacts: [] }, { artifacts: [{ ...receipt, expired: true }] },
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

test('通常配信では同じSHAの検証済みpushの実行回・静的検査環境・公開ファイルのハッシュを引き継ぐ', async () => {
  const deps = fixture({ changed: () => true, candidates: [candidateRun], checks: [passingChecks] });
  const result = await plan(env, deps);
  assert.equal(result.mode, 'deploy');
  assert.deepEqual(result.candidate, { staticRuntime, publicDigest,
    url: 'https://github.com/example/site/actions/runs/93/attempts/2' });
});

test('fork・PR・別SHA・別ワークフロー・新しい失敗・未完了は再利用しない', async () => {
  for (const fields of [{ head_repository: { full_name: 'other/site' } }, { event: 'pull_request' },
    { event: 'workflow_dispatch' }, { head_branch: 'feature' }, { head_sha: prior }, { path: 'other.yml' },
    { status: 'in_progress' }, { conclusion: 'failure' }, { run_attempt: 0 }]) {
    const result = await plan(env, fixture({ changed: () => true,
      candidates: [{ ...candidateRun, ...fields }], checks: [passingChecks] }));
    assert.equal(result.mode, 'deploy');
    assert.ok(!result.candidate);
  }
  const result = await plan(env, fixture({ changed: () => true, checks: [passingChecks],
    candidates: [candidateRun, { ...candidateRun, id: 94, conclusion: 'failure' }] }));
  assert.ok(!result.candidate);
});

test('スキップ・別実行回・期限切れ・不完全な検査の記録では本番前にテストする', async () => {
  for (const fields of [{ checks: [] }, { checks: [{ ...passingChecks, name: 'minigame-screenshots-93-2' }] },
    { checks: [{ ...passingChecks, expired: true }] }, { checks: [{ ...passingChecks, size_in_bytes: 0 }] },
    { checks: [{ ...passingChecks, name: passingChecks.name.replace('regressions-v2-', 'regressions-v1-') }] },
    { checks: [{ ...passingChecks, name: passingChecks.name.replace('-2-', '-1-') }] },
    { checks: [{ ...passingChecks, name: passingChecks.name.replace(head, prior) }] },
    { checks: [{ ...passingChecks, name: passingChecks.name.slice(0, -1) }] },
    { checks: [passingChecks, passingChecks] }, { checks: [passingChecks], checkTotal: 101 }]) {
    const result = await plan(env, fixture({ changed: () => true, candidates: [candidateRun], ...fields }));
    assert.equal(result.mode, 'deploy');
    assert.ok(!result.candidate);
  }
});

test('手動・復旧・変更なしの配信は候補を検索せず、照会障害でも全検証へ戻る', async () => {
  for (const [overrides, fields, expected] of [
    [{ GITHUB_EVENT_NAME: 'workflow_dispatch' }, {}, 'deploy'], [{ GITHUB_RUN_ATTEMPT: '2' }, {}, 'deploy'],
    [{}, { live: head }, 'deploy'], [{}, { artifacts: [] }, 'deploy'],
    [{}, { changed: () => false }, 'unchanged'], [{}, { main: prior }, 'superseded'],
  ]) {
    const deps = fixture({ changed: () => true, candidates: [candidateRun], checks: [passingChecks], ...fields });
    const result = await plan({ ...env, ...overrides }, deps);
    assert.equal(result.mode, expected);
    assert.ok(!result.candidate);
    assert.ok(!deps.requests.some(route => route.includes('dry-run.yml')));
  }
  const deps = fixture({ changed: () => true });
  const result = await plan(env, { ...deps, api(route, filter) {
    if (route.includes('dry-run.yml')) throw new Error('GitHub unavailable');
    return deps.api(route, filter);
  } });
  assert.equal(result.mode, 'deploy');
  assert.ok(!result.candidate);
});

test('配信の検証条件を定義する共通スクリプトだけの変更でもmainで新しい判定を通す', () => {
  for (const path of ['.github/scripts/regression-runtime.sh', '.github/scripts/check-static-site.sh', '.github/scripts/stage-public.sh',
    '.github/actions/check-minigames/action.yml']) {
    assert.equal(classify([path]).deployNeeded, true, path);
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
