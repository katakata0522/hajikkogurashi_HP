'use strict';

const { execFileSync } = require('node:child_process');
const { appendFileSync } = require('node:fs');
const { classify } = require('./detect-deploy-impact.cjs');

const SHA = /^[0-9a-f]{40}$/;
const SITE_MARKER = 'https://hajikkoroom.xsrv.jp/deploy-version.txt';
const WORKFLOW = '.github/workflows/deploy.yml';

function gh(route, filter) {
  const args = ['api', route];
  if (filter) args.push('--jq', filter);
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', timeout: 20000 }));
}

async function liveRevision() {
  const url = new URL(SITE_MARKER);
  url.searchParams.set('probe', `${process.env.GITHUB_RUN_ID || 'local'}-${Date.now()}`);
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (response.status !== 200) throw new Error(`公開版の取得に失敗しました (HTTP ${response.status})`);
  const sha = (await response.text()).replace(/\r?\n$/, '');
  if (!SHA.test(sha)) throw new Error('公開版の形式が不正です');
  return sha;
}

function publicChanges(base, head, cwd) {
  if (!SHA.test(base) || !SHA.test(head)) throw new Error('コミットを確認できません');
  const options = { cwd, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024 };
  execFileSync('git', ['merge-base', '--is-ancestor', base, head], options);
  const diff = execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', base, head], options);
  const paths = diff.split('\0').filter(Boolean);
  return paths.some(p => p !== p.trim() || /[\r\n\\]/.test(p)) || classify(paths).deployNeeded;
}

function previousProof(env, api) {
  const prefix = `repos/${env.GITHUB_REPOSITORY}/actions`;
  const number = Number(env.GITHUB_RUN_NUMBER) - 1;
  if (!Number.isSafeInteger(number) || number < 1) return null;
  // A page of full Actions records can exceed the child process stdout limit.
  // Emit only the single trusted candidate and the fields checked below.
  const filter = `[.workflow_runs[] | select(.run_number == ${number}) |
    {id,run_number,run_attempt,status,conclusion,event,path,head_branch,head_repository:{full_name:.head_repository.full_name}}]`;
  const runs = api(`${prefix}/workflows/deploy.yml/runs?branch=main&per_page=100`, filter);
  const previous = runs.length === 1 && runs[0].run_number === number && runs[0];
  if (!previous || previous.status !== 'completed' || previous.conclusion !== 'success' ||
      !['push', 'workflow_dispatch'].includes(previous.event) || previous.path !== WORKFLOW ||
      previous.head_branch !== 'main' || previous.head_repository?.full_name !== env.GITHUB_REPOSITORY) return null;
  const result = api(`${prefix}/runs/${previous.id}/artifacts?per_page=100`);
  if (result.artifacts.length !== result.total_count) return null;
  const namePrefix = `hp-verified-v1-${previous.run_attempt}-`;
  const matches = result.artifacts.filter(a => !a.expired && a.size_in_bytes > 0 && a.name.startsWith(namePrefix));
  const sha = matches.length === 1 && matches[0].name.slice(namePrefix.length);
  return sha && SHA.test(sha) ? sha : null;
}

async function plan(env, { api = gh, readLive = liveRevision, changed = publicChanges } = {}) {
  const head = env.GITHUB_SHA;
  const main = api(`repos/${env.GITHUB_REPOSITORY}/git/ref/heads/main`).object.sha;
  if (!SHA.test(head) || !SHA.test(main)) throw new Error('現在のmainを確認できません');
  if (main !== head) return { mode: 'superseded', reason: '新しいmainの配信に引き継ぎます。' };
  const deploy = reason => ({ mode: 'deploy', verified: head, reason });
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch' || env.GITHUB_RUN_ATTEMPT !== '1') {
    return deploy('現在のmainの手動配信・再実行は全体を検証して配信します。');
  }
  try {
    const verified = previousProof(env, api);
    if (!verified) return deploy('直前の成功と検証済みの版を確認できないため、全体を配信します。');
    if (await readLive() !== verified) return deploy('公開中の版と前回の検証記録が異なります。');
    if (changed(verified, head)) return deploy('最後に本番確認した版から公開対象に変更があります。');
    return { mode: 'unchanged', verified, reason: '本番の検証記録・版表示が一致し、公開対象に累積差分はありません。' };
  } catch (error) {
    return deploy(`配信省略の根拠を確認できません (${error.code || error.name})。全体を配信します。`);
  }
}

async function main() {
  if (process.argv[2] === '--live-revision') {
    const mainSha = execFileSync('git', ['rev-parse', 'refs/remotes/origin/main'], { encoding: 'utf8' }).trim();
    const live = await liveRevision();
    if (publicChanges(live, mainSha)) throw new Error('本番からmainまでに未反映の公開変更があります');
    appendFileSync(process.env.GITHUB_OUTPUT, `sha=${live}\n`);
    return;
  }
  const result = await plan(process.env);
  appendFileSync(process.env.GITHUB_OUTPUT, `mode=${result.mode}\ndeploy_needed=${result.mode === 'deploy'}\nverified_sha=${result.verified || ''}\n`);
  console.log(result.reason);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.reason + '\n');
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { plan, publicChanges };
