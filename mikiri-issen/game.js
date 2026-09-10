    (() => {
      'use strict';

      const VERSION = '1.3.0';
      const STORAGE_KEY = 'mikiri-issen-record-v6';
      const RESULT_DELAY_MS = 940;

      const enemies = [
        { name: '町の剣士', title: '一人目', rank: '★☆☆☆☆', reactionMs: 480, cssClass: 'enemy-town', minWaitMs: 1600, maxWaitMs: 3800, flavor: 'まずは落ち着いて合図を見る相手です。' },
        { name: '道場破り', title: '二人目', rank: '★★☆☆☆', reactionMs: 385, cssClass: 'enemy-dojo', minWaitMs: 1900, maxWaitMs: 5200, flavor: '油断すると斬られます。合図だけを見ましょう。' },
        { name: '早耳の忍び', title: '三人目', rank: '★★★☆☆', reactionMs: 340, cssClass: 'enemy-ninja', minWaitMs: 2000, maxWaitMs: 6200, flavor: '速い相手です。長い待ちに飲まれないように。' },
        { name: '無口な達人', title: '四人目', rank: '★★★★☆', reactionMs: 315, cssClass: 'enemy-master', minWaitMs: 2200, maxWaitMs: 7200, flavor: '一瞬の迷いが負けにつながります。' },
        { name: '影の剣豪', title: '五人目', rank: '★★★★★', reactionMs: 295, cssClass: 'enemy-shadow', minWaitMs: 2400, maxWaitMs: 8500, flavor: 'ここからは本気の領域。かなり厳しい勝負です。' },
        { name: '刹那の鬼', title: '六人目', rank: '★★★★★', reactionMs: 285, cssClass: 'enemy-demon', minWaitMs: 2600, maxWaitMs: 9200, flavor: '人間離れした速さ。ここを越えれば達人です。' },
        { name: '刹那の鬼・真', title: '隠しボス', rank: '★★★★★★', reactionMs: 260, cssClass: 'enemy-demon', minWaitMs: 2800, maxWaitMs: 9800, flavor: '限界突破の一戦。勝てなくても当然の相手です。', hidden: true },
      ];

      const enemyClassNames = enemies.map((enemy) => enemy.cssClass);

      const screens = {
        title: document.getElementById('titleScreen'),
        play: document.getElementById('playScreen'),
        result: document.getElementById('resultScreen'),
      };

      const elements = {
        startButton: document.getElementById('startButton'),
        retryButton: document.getElementById('retryButton'),
        restartButton: document.getElementById('restartButton'),
        backTitleButton: document.getElementById('backTitleButton'),
        shareButton: document.getElementById('shareButton'),
        resetRecordButton: document.getElementById('resetRecordButton'),
        soundButton: document.getElementById('soundButton'),
        howtoButton: document.getElementById('howtoButton'),
        howtoPanel: document.getElementById('howtoPanel'),
        arena: document.getElementById('arena'),
        stateLabel: document.getElementById('stateLabel'),
        instructionText: document.getElementById('instructionText'),
        enemyTitleLabel: document.getElementById('enemyTitleLabel'),
        enemyRankLabel: document.getElementById('enemyRankLabel'),
        enemyNameLabel: document.getElementById('enemyNameLabel'),
        enemyNameplate: document.getElementById('enemyNameplate'),
        playerFighterWrap: document.getElementById('playerFighterWrap'),
        enemyFighterWrap: document.getElementById('enemyFighterWrap'),
        playerSlash: document.getElementById('playerSlash'),
        enemySlash: document.getElementById('enemySlash'),
        impactText: document.getElementById('impactText'),
        resultCard: document.getElementById('resultCard'),
        judgeLabel: document.getElementById('judgeLabel'),
        resultTime: document.getElementById('resultTime'),
        reactionHelp: document.getElementById('reactionHelp'),
        differenceLabel: document.getElementById('differenceLabel'),
        enemyResultLabel: document.getElementById('enemyResultLabel'),
        enemyRankResultLabel: document.getElementById('enemyRankResultLabel'),
        enemySpeedLabel: document.getElementById('enemySpeedLabel'),
        resultComment: document.getElementById('resultComment'),
        resultBest: document.getElementById('resultBest'),
        resultStreak: document.getElementById('resultStreak'),
        resultMaxStreak: document.getElementById('resultMaxStreak'),
        resultTotalWins: document.getElementById('resultTotalWins'),
        waitTimeLabel: document.getElementById('waitTimeLabel'),
        nextEnemyLabel: document.getElementById('nextEnemyLabel'),
        titleBestLabel: document.getElementById('titleBestLabel'),
        titleMaxStreakLabel: document.getElementById('titleMaxStreakLabel'),
        titleTotalWinsLabel: document.getElementById('titleTotalWinsLabel'),
        toast: document.getElementById('toast'),
        newBestBadge: document.getElementById('newBestBadge'),
        rankBadge: document.getElementById('rankBadge'),
        masterComment: document.getElementById('masterComment'),
        topleftFoulBadge: document.getElementById('topleftFoulBadge'),
        nextEnemyPreview: document.getElementById('nextEnemyPreview'),
        quickRestartButton: document.getElementById('quickRestartButton'),
      };

      const game = {
        state: 'title',
        waitTimer: null,
        resultTimer: null,
        restartTimer: null,
        signalAt: 0,
        roundStartedAt: 0,
        waitMs: 0,
        streak: 0,
        currentEnemyIndex: 0,
        earlyFoulCount: 0,
        lastResult: null,
        soundEnabled: true,
        audioContext: null,
        record: {
          bestMs: null,
          maxStreak: 0,
          totalWins: 0,
        },
      };

      function loadRecord() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.bestMs === 'number' || parsed.bestMs === null) game.record.bestMs = parsed.bestMs;
            if (Number.isInteger(parsed.maxStreak) && parsed.maxStreak >= 0) game.record.maxStreak = parsed.maxStreak;
            if (Number.isInteger(parsed.totalWins) && parsed.totalWins >= 0) game.record.totalWins = parsed.totalWins;
            if (typeof parsed.soundEnabled === 'boolean') game.soundEnabled = parsed.soundEnabled;
          }
          const globalMute = localStorage.getItem('katakata-minigames-mute');
          if (globalMute !== null) {
            game.soundEnabled = (globalMute === 'false');
          } else {
            localStorage.setItem('katakata-minigames-mute', String(!game.soundEnabled));
          }
        } catch (error) {
          console.warn('記録の読み込みに失敗しました。', error);
        }
      }

      function saveRecord() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            bestMs: game.record.bestMs,
            maxStreak: game.record.maxStreak,
            totalWins: game.record.totalWins,
            soundEnabled: game.soundEnabled,
          }));
          localStorage.setItem('katakata-minigames-mute', String(!game.soundEnabled));
        } catch (error) {
          console.warn('記録の保存に失敗しました。', error);
        }
      }

      function showScreen(name) {
        Object.values(screens).forEach((screen) => screen.classList.remove('is-active'));
        screens[name].classList.add('is-active');
      }

      function getCurrentEnemy() {
        return enemies[Math.min(game.currentEnemyIndex, enemies.length - 1)];
      }

      function isLastEnemy() {
        return game.currentEnemyIndex >= enemies.length - 1;
      }

      function isNormalFinalEnemy() {
        const hiddenBossIndex = enemies.findIndex((enemy) => enemy.hidden === true);
        return hiddenBossIndex > 0 && game.currentEnemyIndex === hiddenBossIndex - 1;
      }

      function isHiddenBoss() {
        return getCurrentEnemy().hidden === true;
      }

      function getNextEnemyName() {
        if (isLastEnemy()) return '最初から';
        const nextIndex = game.currentEnemyIndex + 1;
        return enemies[nextIndex].name;
      }

      function toReactionValue(ms) {
        if (typeof ms !== 'number' || Number.isNaN(ms)) return null;
        return Math.floor(Math.max(0, ms) / 10);
      }

      function formatReaction(ms) {
        const value = toReactionValue(ms);
        if (value === null) return '--';
        if (value > 99) return '99+';
        return String(value).padStart(2, '0');
      }

      function formatReactionDiff(ms) {
        if (typeof ms !== 'number' || Number.isNaN(ms)) return '--';
        const value = Math.ceil(Math.max(0, ms) / 10);
        if (value <= 0) return '00';
        if (value > 99) return '99+';
        return String(value).padStart(2, '0');
      }

      function formatSeconds(ms) {
        if (typeof ms !== 'number' || Number.isNaN(ms)) return '-- 秒';
        return `${(ms / 1000).toFixed(2)} 秒`;
      }

      function randomWait(enemy) {
        return Math.floor(enemy.minWaitMs + Math.random() * (enemy.maxWaitMs - enemy.minWaitMs + 1));
      }

      function updateRecordView() {
        elements.titleBestLabel.textContent = formatReaction(game.record.bestMs);
        elements.titleMaxStreakLabel.textContent = `${game.record.maxStreak} 人`;
        elements.titleTotalWinsLabel.textContent = `${game.record.totalWins} 勝`;
        elements.soundButton.textContent = game.soundEnabled ? '音 ON' : '音 OFF';
        elements.soundButton.setAttribute('aria-pressed', String(game.soundEnabled));
      }

      function updateDuelView() {
        const enemy = getCurrentEnemy();
        elements.enemyTitleLabel.textContent = enemy.title;
        elements.enemyRankLabel.textContent = enemy.rank;
        elements.enemyNameLabel.textContent = enemy.name;
        elements.enemyNameplate.textContent = enemy.name;
        elements.enemyFighterWrap.classList.remove(...enemyClassNames);
        elements.enemyFighterWrap.classList.add(enemy.cssClass);
      }

      function resetArenaClasses() {
        elements.arena.classList.remove('is-waiting', 'is-tension', 'is-signal', 'is-resolved', 'is-failed');
        elements.playerFighterWrap.classList.remove('winner', 'loser');
        elements.enemyFighterWrap.classList.remove('winner', 'loser');
        elements.playerSlash.classList.remove('player-hit');
        elements.enemySlash.classList.remove('enemy-hit');
      }

      function setWaitingText() {
        elements.stateLabel.innerHTML = '待て<span class="wait-dots"><i></i><i></i><i></i></span>';
        elements.instructionText.textContent = '合図が出るまで、押さない。';
      }

      function clearTimers() {
        window.clearTimeout(game.waitTimer);
        window.clearTimeout(game.resultTimer);
        window.clearTimeout(game.restartTimer);
        game.waitTimer = null;
        game.resultTimer = null;
        game.restartTimer = null;
      }

      function prepareAudio() {
        if (!game.soundEnabled) return null;
        if (!game.audioContext) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return null;
          game.audioContext = new AudioContext();
        }
        if (game.audioContext.state === 'suspended') {
          game.audioContext.resume().catch(() => {});
        }
        return game.audioContext;
      }

      function playTone(type) {
        try {
          const context = prepareAudio();
          if (!context) return;
          const now = context.currentTime;

          if (type === 'click') {
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(650, now);
            osc.frequency.exponentialRampToValueAtTime(1100, now + 0.025);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
            osc.connect(gain);
            gain.connect(context.destination);
            osc.start(now);
            osc.stop(now + 0.04);
            return;
          }

          if (type === 'victory_fanfare') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
              const osc = context.createOscillator();
              const gain = context.createGain();
              const noteTime = now + i * 0.085;
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, noteTime);
              gain.gain.setValueAtTime(0.0001, noteTime);
              gain.gain.exponentialRampToValueAtTime(0.18, noteTime + 0.015);
              gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.38);
              osc.connect(gain);
              gain.connect(context.destination);
              osc.start(noteTime);
              osc.stop(noteTime + 0.4);
            });
            return;
          }

          if (type === 'new_best') {
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
            notes.forEach((freq, i) => {
              const osc = context.createOscillator();
              const gain = context.createGain();
              const noteTime = now + i * 0.07;
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, noteTime);
              gain.gain.setValueAtTime(0.0001, noteTime);
              gain.gain.exponentialRampToValueAtTime(0.22, noteTime + 0.015);
              gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.48);
              osc.connect(gain);
              gain.connect(context.destination);
              osc.start(noteTime);
              osc.stop(noteTime + 0.5);
            });
            return;
          }

          if (type === 'defeat_gong') {
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(38, now + 0.45);
            gain.gain.setValueAtTime(0.32, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.connect(gain);
            gain.connect(context.destination);
            osc.start(now);
            osc.stop(now + 0.51);
            return;
          }

          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.connect(gain);
          gain.connect(context.destination);

          oscillator.onended = () => {
            try {
              oscillator.disconnect();
              gain.disconnect();
            } catch (e) {}
          };

          if (type === 'signal') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(760, now);
            oscillator.frequency.exponentialRampToValueAtTime(1260, now + 0.08);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
            oscillator.start(now);
            oscillator.stop(now + 0.19);
            return;
          }

          if (type === 'success') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(170, now);
            oscillator.frequency.exponentialRampToValueAtTime(1040, now + 0.075);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
            oscillator.start(now);
            oscillator.stop(now + 0.28);
            return;
          }

          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(120, now);
          oscillator.frequency.exponentialRampToValueAtTime(78, now + 0.16);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.13, now + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
          oscillator.start(now);
          oscillator.stop(now + 0.25);
        } catch (e) {
          console.warn('Audio playback suppressed:', e);
        }
      }

      function startRun() {
        game.earlyFoulCount = 0;
        game.streak = 0;
        game.currentEnemyIndex = 0;
        startRound();
      }

      function startNextRound() {
        game.earlyFoulCount = 0;
        if (game.lastResult && game.lastResult.win) {
          if (isLastEnemy()) {
            startRun();
          } else {
            game.currentEnemyIndex = Math.min(game.currentEnemyIndex + 1, enemies.length - 1);
            startRound();
          }
        } else {
          // 敗北時は現在の敵と再戦！(1人目に戻らない)
          startRound();
        }
      }
      

      function startRound() {
        if (elements.topleftFoulBadge) elements.topleftFoulBadge.style.display = (game.earlyFoulCount > 0) ? 'inline-flex' : 'none';
        if (elements.quickRestartButton) elements.quickRestartButton.style.display = 'inline-flex';
        clearTimers();
        prepareAudio();
        const enemy = getCurrentEnemy();
        game.state = 'waiting';
        game.signalAt = 0;
        game.roundStartedAt = performance.now();
        game.waitMs = randomWait(enemy);

        resetArenaClasses();
        elements.arena.classList.add('is-waiting', 'is-tension');
        setWaitingText();
        updateDuelView();
        showScreen('play');

        window.setTimeout(() => {
          elements.arena.focus({ preventScroll: true });
        }, 60);

        game.waitTimer = window.setTimeout(showSignal, game.waitMs);
      }

      function showSignal() {
        if (game.state !== 'waiting') return;
        game.state = 'signal';
        game.signalAt = performance.now();
        elements.arena.classList.remove('is-waiting', 'is-tension');
        elements.arena.classList.add('is-signal');
        elements.stateLabel.textContent = '今！';
        elements.instructionText.textContent = '斬れ！';
        playTone('signal');
      }

      function judgeReaction(ms, enemy) {
        const diff = enemy.reactionMs - ms;
        if (diff >= 0) {
          if (ms < 155) return { label: '神速勝利', comment: `${enemy.name}を光と同時に斬りました。これはかなり強い記録です。` };
          if (ms < 220) return { label: '一閃勝利', comment: `${enemy.name}より先に動きました。迷いの少ない一撃です。` };
          return { label: '見切り勝利', comment: `${enemy.name}の動きを見切りました。次の相手はさらに速くなります。` };
        }

        const behind = Math.abs(diff);
        if (behind <= 35) return { label: '惜敗', comment: `あと反応値${formatReactionDiff(behind)}でした。勝負は見えていました。もう一回で届きます。` };
        return { label: '敗北', comment: `${enemy.name}の方が早く動きました。深い「ため」に飲まれず、合図だけを狙いましょう。` };
      }

      function resolveReaction() {
        if (game.state !== 'signal') return;
        game.state = 'resolved';
        const enemy = getCurrentEnemy();
        const reactionMs = Math.max(0, Math.round(performance.now() - game.signalAt));
        const diffMs = enemy.reactionMs - reactionMs;
        const win = diffMs >= 0;
        const isNewBest = win && (game.record.bestMs === null || reactionMs < game.record.bestMs);
        const judge = judgeReaction(reactionMs, enemy);

        if (isNewBest) game.record.bestMs = reactionMs;

        if (win) {
          game.streak += 1;
          game.record.totalWins += 1;
          game.record.maxStreak = Math.max(game.record.maxStreak, game.streak);
        } else {
          game.streak = 0;
        }

        game.lastResult = {
          win,
          early: false,
          reactionMs,
          enemyName: enemy.name,
          enemyTitle: enemy.title,
          enemyRank: enemy.rank,
          enemyReactionMs: enemy.reactionMs,
          diffMs,
          judgeLabel: win && isHiddenBoss() ? '限界突破' : (win && isNormalFinalEnemy() ? '完全勝利' : judge.label),
          comment: win && isHiddenBoss()
            ? '隠しボスを斬りました。これはもう反射神経の記録として誇っていい一撃です。'
            : (win && isNormalFinalEnemy() ? '最後の相手を斬りました。だが、奥にまだ一人だけ気配が残っています。' : judge.comment),
          isNewBest,
          waitMs: game.waitMs,
          streak: game.streak,
        };

        saveRecord();
        updateRecordView();
        updateDuelView();

        elements.arena.classList.remove('is-signal');
        elements.arena.classList.add('is-resolved');
        elements.impactText.textContent = win ? '一閃' : '遅れ';
        elements.stateLabel.textContent = win ? '勝負あり' : '斬られた';
        elements.instructionText.textContent = `反応値 ${formatReaction(reactionMs)}`;

        if (win) {
          elements.playerFighterWrap.classList.add('winner');
          elements.enemyFighterWrap.classList.add('loser');
          elements.playerSlash.classList.add('player-hit');
          playTone('success');
        } else {
          elements.enemyFighterWrap.classList.add('winner');
          elements.playerFighterWrap.classList.add('loser');
          elements.enemySlash.classList.add('enemy-hit');
          playTone('fail');
        }

        game.resultTimer = window.setTimeout(() => {
          if (game.state === 'resolved') {
            showResult(game.lastResult);
          }
        }, RESULT_DELAY_MS);
      }

      function resolveEarlyFail(reason) {
        if (game.state === 'resolved' || game.state === 'failed' || game.state === 'restarting') return;
        if (reason === 'early' && game.earlyFoulCount < 1) {
          game.earlyFoulCount += 1;
          game.state = 'restarting';
          clearTimers();
          playTone('fail');
          if (elements.topleftFoulBadge) elements.topleftFoulBadge.style.display = 'inline-flex';
          elements.stateLabel.textContent = 'フライング！';
          elements.instructionText.textContent = '❌ お手つき1回！同じ敵と仕切り直し';
          elements.impactText.textContent = '待て';
          elements.arena.classList.add('is-failed');
          game.restartTimer = window.setTimeout(() => {
            if (game.state === 'restarting') startRound();
          }, 900);
          return;
        }
        if (game.state === 'resolved' || game.state === 'failed') return;
        const enemy = getCurrentEnemy();
        clearTimers();
        game.state = 'failed';
        game.streak = 0;
        resetArenaClasses();
        elements.arena.classList.add('is-failed', 'is-resolved');
        elements.impactText.textContent = reason === 'hidden' ? '中断' : 'お手付き';
        elements.stateLabel.textContent = reason === 'hidden' ? '中断' : '早すぎ';
        elements.instructionText.textContent = 'まだ「！」は出ていません。';
        playTone('fail');

        game.lastResult = {
          win: false,
          early: true,
          reactionMs: null,
          enemyName: enemy.name,
          enemyTitle: enemy.title,
          enemyRank: enemy.rank,
          enemyReactionMs: enemy.reactionMs,
          diffMs: null,
          judgeLabel: reason === 'hidden' ? '中断' : '早すぎ！',
          comment: reason === 'hidden'
            ? '勝負中に画面を離れたため中断しました。'
            : '合図の前に動いてしまいました。すぐにもう一回いきましょう。',
          isNewBest: false,
          waitMs: game.waitMs,
          streak: 0,
        };

        saveRecord();
        updateRecordView();
        updateDuelView();
        game.resultTimer = window.setTimeout(() => {
          if (game.state === 'failed') {
            showResult(game.lastResult);
          }
        }, 420);
      }

      function getRankInfo(result) {
        if (result.early) {
          return { rank: '⚠️ お手つきフライング', comment: '静寂の中に機あり…「！」をじっと待つべし。' };
        }
        const streak = result.streak || 0;

        if (!result.win) {
          if (streak === 0) return { rank: '🛡️ 新米剣士', comment: '初戦敗北…道は遠し！一瞬の集中力を研ぎ澄ませ！' };
          if (streak === 1) return { rank: '🗡️ 一刀流の使手', comment: '1人撃破で無念の無言…次こそ連勝を伸ばせ！' };
          if (streak === 2) return { rank: '⚔️ 道場主級の剣豪', comment: '2人撃破！猛者たちの壁は厚いが再戦あるのみ！' };
          if (streak === 3) return { rank: '🥷 影を斬る風刃', comment: '3人撃破！疾風の如き忍びを制した腕前！' };
          if (streak === 4) return { rank: '🛡️ 鉄壁の破砕者', comment: '4人撃破！巨漢の鉄壁を打ち破った猛者！' };
          if (streak === 5) return { rank: '🎖️ 免許皆伝の師範代', comment: '5人撃破！極みの領域まであと一歩だった…！' };
          return { rank: '👹 鬼神に挑みし猛者', comment: '6人破るも鬼に散る…だがその剣閃は本物だ！' };
        }

        if (streak === 1) return { rank: '🗡️ 【1人抜き】一刀流の使手', comment: '一人目を討ち取ったり！まだ序の口に過ぎぬ！' };
        if (streak === 2) return { rank: '⚔️ 【2人抜き】道場主級の剣豪', comment: '二人目を破ったり！道場の猛者を制した！' };
        if (streak === 3) return { rank: '🥷 【3人抜き】影を斬る風刃', comment: '三人目を破ったり！忍びの疾風を斬り伏せた！' };
        if (streak === 4) return { rank: '🛡️ 【4人抜き】鉄壁の破砕者', comment: '四人目を破ったり！巨漢の鉄壁を打ち破った！' };
        if (streak === 5) return { rank: '🎖️ 【5人抜き】免許皆伝の師範代', comment: '五人目を破ったり！もはや師範代クラスの領域！' };
        if (streak === 6) return { rank: '👹 【6人抜き】鬼神殺しの英雄', comment: '六人全斬り！ついに刹那の鬼を討ち取った！' };
        return { rank: '👑 【全関門踏破】天下無双の剣聖', comment: '全隠しボス完全踏破！歴史に名を刻む伝説の剣聖！' };
      }

      function showResult(result) {
        game.state = 'result';
        if (elements.resultCard) {
          elements.resultCard.classList.toggle('is-lose', !result.win && !result.early);
          elements.resultCard.classList.toggle('is-early', result.early);
        }
        if (elements.judgeLabel) elements.judgeLabel.textContent = result.judgeLabel;

        if (elements.newBestBadge) {
          elements.newBestBadge.style.display = result.isNewBest ? 'inline-flex' : 'none';
        }

        const rankInfo = getRankInfo(result);
        if (elements.rankBadge) {
          elements.rankBadge.textContent = rankInfo.rank;
        }
        if (elements.masterComment) {
          elements.masterComment.textContent = `「${rankInfo.comment}」`;
        }

        if (result.early) {
          if (elements.reactionHelp) elements.reactionHelp.style.display = 'none';
          if (elements.resultTime) elements.resultTime.innerHTML = '合図前<small></small>';
        } else {
          if (elements.reactionHelp) elements.reactionHelp.style.display = 'block';
          if (elements.resultTime) {
            if (result.reactionMs !== null) {
              const targetVal = toReactionValue(result.reactionMs);
              const duration = 240;
              const startTime = performance.now();
              function animateCount(now) {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / duration);
                const currentVal = Math.floor(progress * targetVal);
                if (elements.resultTime) {
                  elements.resultTime.innerHTML = `${String(currentVal).padStart(2, '0')}<small>反応値</small>`;
                }
                if (progress < 1) {
                  requestAnimationFrame(animateCount);
                } else if (elements.resultTime) {
                  elements.resultTime.innerHTML = `${formatReaction(result.reactionMs)}<small>反応値</small>`;
                }
              }
              requestAnimationFrame(animateCount);
            } else {
              elements.resultTime.innerHTML = 'MISS<small></small>';
            }
          }
        }

        if (elements.enemyResultLabel) elements.enemyResultLabel.textContent = `敵：${result.enemyName}`;
        if (elements.enemyRankResultLabel) elements.enemyRankResultLabel.textContent = result.enemyRank;
        if (elements.enemySpeedLabel) elements.enemySpeedLabel.textContent = `敵の反応値：${formatReaction(result.enemyReactionMs)}`;
        if (elements.waitTimeLabel) elements.waitTimeLabel.textContent = `待機：${formatSeconds(result.waitMs)}`;

        if (elements.differenceLabel) {
          if (result.diffMs === null) {
            elements.differenceLabel.textContent = result.early ? 'もう一回いける' : '合図前に動いた';
          } else if (result.diffMs >= 0) {
            elements.differenceLabel.textContent = `敵より ${formatReactionDiff(result.diffMs)} 早い`;
          } else {
            elements.differenceLabel.textContent = `あと ${formatReactionDiff(Math.abs(result.diffMs))} 足りない`;
          }
        }

        if (elements.resultComment) elements.resultComment.textContent = result.comment;
        if (elements.resultBest) elements.resultBest.textContent = formatReaction(game.record.bestMs);
        if (elements.resultStreak) elements.resultStreak.textContent = `${result.streak} 人`;
        if (elements.resultMaxStreak) elements.resultMaxStreak.textContent = `${game.record.maxStreak} 人`;
        if (elements.resultTotalWins) elements.resultTotalWins.textContent = `${game.record.totalWins} 勝`;
        if (elements.nextEnemyLabel) elements.nextEnemyLabel.textContent = result.win ? getNextEnemyName() : enemies[0].name;
        if (elements.retryButton) {
          elements.retryButton.textContent = result.win
            ? (isLastEnemy() ? '最初から' : (isNormalFinalEnemy() ? '隠しボスへ' : '次の相手へ'))
            : 'もう一回';
        }

        if (elements.nextEnemyPreview) {
          if (result.win) {
            elements.nextEnemyPreview.style.display = 'inline-flex';
            elements.nextEnemyPreview.textContent = isLastEnemy()
              ? '⚔️ 全関門制覇！最初から再挑戦'
              : `次戦：${enemies[Math.min(game.currentEnemyIndex + 1, enemies.length - 1)].name} (${enemies[Math.min(game.currentEnemyIndex + 1, enemies.length - 1)].rank})`;
          } else {
            elements.nextEnemyPreview.style.display = 'inline-flex';
            elements.nextEnemyPreview.textContent = `リベンジ：${enemies[game.currentEnemyIndex].name} と再戦`;
          }
        }

        if (result.isNewBest) {
          playTone('new_best');
        } else if (result.win) {
          playTone('victory_fanfare');
        } else {
          playTone('defeat_gong');
        }

        if (elements.quickRestartButton) elements.quickRestartButton.style.display = 'none';
        showScreen('result');
      }

      function handleAction() {
        if (game.state === 'waiting') {
          if (performance.now() - game.roundStartedAt < 220) return;
          resolveEarlyFail('early');
          return;
        }
        if (game.state === 'signal') {
          resolveReaction();
        }
      }

      async function shareResult() {
        const result = game.lastResult;
        if (!result) {
          showToast('まだ共有できる結果がありません');
          return;
        }

        const url = 'https://hajikkoroom.xsrv.jp/mikiri-issen/';
        const score = result.reactionMs !== null ? `反応値${formatReaction(result.reactionMs)}` : 'MISS';
        const diff = result.diffMs === null
          ? '合図前に動いた'
          : result.diffMs >= 0
            ? `敵より${formatReactionDiff(result.diffMs)}早い`
            : `あと${formatReactionDiff(Math.abs(result.diffMs))}`;
        const text = result.win
          ? `みきり一閃で${result.enemyName}に勝利！ ${score}（${diff}）/ 現在${result.streak}人抜き / 最高${game.record.maxStreak}人抜き ${url} #かたかたミニゲーム`
          : `みきり一閃で${result.enemyName}に敗北… ${score}（${diff}）/ 最高${game.record.maxStreak}人抜き ${url} #かたかたミニゲーム`;

        try {
          if (navigator.share) {
            await navigator.share({ title: 'みきり一閃', text, url });
            return;
          }
          await navigator.clipboard.writeText(text);
          showToast('結果をコピーしました');
        } catch (error) {
          console.warn('共有に失敗しました。', error);
          showToast('共有をキャンセルしました');
        }
      }

      function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.add('is-visible');
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => {
          elements.toast.classList.remove('is-visible');
        }, 1800);
      }

      function backToTitle() {
        clearTimers();
        game.state = 'title';
        if (elements.quickRestartButton) elements.quickRestartButton.style.display = 'none';
        resetArenaClasses();
        updateRecordView();
        showScreen('title');
      }

      function triggerTouchRipple(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number' || x <= 0 || y <= 0) return;
        try {
          const ripple = document.createElement('div');
          ripple.className = 'touch-ripple';
          ripple.style.left = `${x}px`;
          ripple.style.top = `${y}px`;
          document.body.appendChild(ripple);
          window.setTimeout(() => {
            try { ripple.remove(); } catch (e) {}
          }, 340);
        } catch (e) {}
      }

      function resetRecord() {
        if (!window.confirm('記録をリセットしますか？')) return;
        game.record.bestMs = null;
        game.record.maxStreak = 0;
        game.record.totalWins = 0;
        game.streak = 0;
        game.currentEnemyIndex = 0;
        game.lastResult = null;
        saveRecord();
        updateRecordView();
        if (elements.howtoPanel && elements.howtoPanel.classList.contains('is-open')) {
          toggleHowto();
        }
        showToast('記録をリセットしました');
      }

      function toggleSound() {
        game.soundEnabled = !game.soundEnabled;
        saveRecord();
        updateRecordView();
        if (game.soundEnabled) playTone('signal');
      }

      function toggleHowto() {
        if (!elements.howtoPanel) return;
        const isOpen = elements.howtoPanel.classList.toggle('is-open');
        if (elements.howtoButton) elements.howtoButton.setAttribute('aria-expanded', String(isOpen));
        elements.howtoPanel.setAttribute('aria-hidden', String(!isOpen));
      }

      function safeCall(handler) {
        try {
          const result = handler();
          if (result && typeof result.catch === 'function') {
            result.catch((error) => console.error('Mikiri action failed:', error));
          }
          return result;
        } catch (error) {
          console.error('Mikiri action failed:', error);
          return undefined;
        }
      }

      function bindButton(element, handler) {
        if (!element) return;
        let lastTrigger = 0;
        const trigger = (event) => {
          const now = performance.now();
          if (now - lastTrigger < 250) return;
          lastTrigger = now;
          if (event) {
            event.stopPropagation();
          }
          safeCall(handler);
        };

        element.addEventListener('click', trigger);
        element.addEventListener('pointerdown', (e) => {
          if (e.isPrimary && e.button === 0) {
            trigger(e);
          }
        });
      }

      bindButton(elements.startButton, startRun);
      bindButton(elements.retryButton, startNextRound);
      if (elements.restartButton) bindButton(elements.restartButton, startRun);
      bindButton(elements.backTitleButton, backToTitle);
      bindButton(elements.shareButton, shareResult);
      bindButton(elements.resetRecordButton, resetRecord);
      bindButton(elements.soundButton, toggleSound);
      bindButton(elements.howtoButton, toggleHowto);
      const closeHowtoBtn = document.getElementById('closeHowtoButton');
      if (closeHowtoBtn) bindButton(closeHowtoBtn, toggleHowto);
      if (elements.quickRestartButton) {
        bindButton(elements.quickRestartButton, () => {
          if (window.confirm('最初（一人目）からやり直しますか？')) startRun();
        });
      }
      elements.howtoPanel.addEventListener('click', (e) => {
        if (e.target === elements.howtoPanel) toggleHowto();
      });

      // スマホのゴーストタップと、画面外タッチ時の無反応を防ぐため window 全体で監視
      window.addEventListener('pointerdown', (event) => {
        triggerTouchRipple(event.clientX, event.clientY);
        if (elements.howtoPanel && elements.howtoPanel.classList.contains('is-open')) return;
        if (game.state !== 'waiting' && game.state !== 'signal') return;
        if (
          event.target.tagName === 'BUTTON' ||
          event.target.closest('button') ||
          event.target.tagName === 'A' ||
          event.target.closest('a') ||
          event.target.closest('.hud-topright') ||
          event.target.closest('.hud-topleft') ||
          event.target.closest('.button-row') ||
          event.target.closest('.result-actions')
        ) {
          return;
        }
        event.preventDefault();
        handleAction();
      }, { passive: false });

      // スペースキー/Enterキーでタイトル画面やリザルト画面からもシームレスに進行可能に（Escapeでモーダル閉じ）
      window.addEventListener('keydown', (event) => {
        if (elements.howtoPanel && elements.howtoPanel.classList.contains('is-open')) {
          if (event.key === 'Escape') {
            safeCall(toggleHowto);
          }
          return;
        }
        if (event.key === ' ' || event.key === 'Enter') {
          if (event.repeat) return;
          if (document.activeElement && (document.activeElement.tagName === 'BUTTON' || document.activeElement.tagName === 'A')) return; // ボタン・リンクフォーカス時は標準動作優先
          event.preventDefault(); // 画面スクロール防止
          
          if (game.state === 'title') {
            safeCall(startRun);
          } else if (game.state === 'result') {
            safeCall(startNextRound);
          } else if (game.state === 'waiting' || game.state === 'signal') {
            handleAction();
          }
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && (game.state === 'waiting' || game.state === 'signal')) {
          resolveEarlyFail('hidden');
        }
      });

      loadRecord();
      updateRecordView();
      updateDuelView();
    })();
