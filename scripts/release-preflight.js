const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireText(relativePath, expected) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`${relativePath} がありません`);
    return;
  }
  if (expected && !read(relativePath).includes(expected)) {
    errors.push(`${relativePath} に必要な設定がありません: ${expected}`);
  }
}

function forbidText(relativePath, forbidden) {
  if (fs.existsSync(path.join(root, relativePath)) && read(relativePath).includes(forbidden)) {
    errors.push(`${relativePath} に不要な処理が残っています: ${forbidden}`);
  }
}

requireText('index.html', 'privacy.html');
requireText('privacy.html', 'プライバシーポリシー');
requireText('support.html', 'コトダマっち サポート');
requireText('data.js', "let currentStage = 0");
requireText('data.js', "let currentForm = 'egg'");
requireText('data.js', 'const SICKNESS_DELAY_MS = 72 * 60 * 60 * 1000');
requireText('data.js', 'const SICKNESS_RECOVERY_GOAL = 10');
requireText('index.html', 'id="infoNavigation"');
requireText('index.html', "chooseBattleAction('attack')");
requireText('main.js', 'function chooseBattleAction(action)');
requireText('main.js', 'function showNextInfoPage()');
requireText('main.js', 'function startInteractiveTutorial(');
requireText('main.js', 'function startFirstLaunchTutorial()');
requireText('main.js', "localStorage.setItem(FIRST_LAUNCH_TUTORIAL_KEY, 'true')");
requireText('main.js', 'function animateProgressGain()');
requireText('main.js', 'function preventViewportZoom()');
requireText('main.js', 'function getRebirthDeadline()');
requireText('main.js', 'function updateRebirthCountdown()');
requireText('main.js', 'function getEnemyStats(playerStats = getBattleStats())');
requireText('index.html', 'id="rebirthCountdown"');
requireText('style.css', '.rebirth-countdown');
requireText('main.js', "'kotodama_state_backup'");
requireText('index.html', 'id="tutorialCoachmark"');
forbidText('index.html', 'id="soundToggleButton"');
forbidText('index.html', '遊び方を見る');
forbidText('index.html', 'id="onboardingOverlay"');
forbidText('main.js', 'function toggleSoundSetting()');
requireText('index.html', 'user-scalable=no');
requireText('style.css', '.word-count-effect');
requireText('style.css', 'touch-action: manipulation');
requireText('style.css', 'animation-name: battleAttackMineReduced');
requireText('style.css', '.aura-100::before');
requireText('style.css', 'animation-iteration-count: infinite !important');
requireText('data.js', 'function playWhenAudioReady(playback)');
requireText('main.js', 'await prepareNativeSpeech()');
requireText('main.js', "micBtnEl.classList.add('mic-starting')");
requireText('index.html', 'onclick="openOnlineBattleMenu()"');
requireText('main.js', 'function createOnlineBattleRoom()');
requireText('main.js', 'function runOnlineBattleSequence(result, seat)');
requireText('online-battle/src/index.mjs', 'export class BattleRoom extends DurableObject');
requireText('online-battle/src/index.mjs', "ROOM_TTL_MS = 15 * 60 * 1000");
requireText('online-battle/src/battle-engine.mjs', 'export function simulateBattle');
requireText('online-battle/wrangler.jsonc', '"class_name": "BattleRoom"');
requireText('online-battle-config.js', 'KOTODAMA_ONLINE_BATTLE_API_URL');
forbidText('main.js', "container.classList.add('word-received-pulse')");
forbidText('main.js', 'renderCanvasArt(currentForm, ctx); // 少し揺らす');
requireText('ios/App/App/Info.plist', 'NSSpeechRecognitionUsageDescription');
requireText('ios/App/App/Info.plist', 'NSMicrophoneUsageDescription');
requireText('ios/App/App/Info.plist', 'UIInterfaceOrientationLandscapeLeft');
requireText('ios/App/App/Info.plist', 'UIInterfaceOrientationLandscapeRight');
requireText('plugins/kotodama-speech-recognition/Package.swift', 'KotodamaSpeechRecognition');

const main = read('main.js');
for (const forbidden of ["wordCounts['愛してます'] = 2980", 'battleWins = 100', 'true || unlockedForms', 'generateChallengeUrl', 'getEnemyStats(totalCount)']) {
  if (main.includes(forbidden)) errors.push(`main.js に開発用コードが残っています: ${forbidden}`);
}

try {
  execFileSync(process.execPath, ['--check', 'main.js'], { cwd: root, stdio: 'pipe' });
} catch {
  errors.push('main.js の構文チェックに失敗しました');
}

const secretFiles = [
  'ios_distribution.key',
  'ios_distribution.p12',
  'ios_distribution.cer',
  'ios_distribution.csr',
  'Kotodama_Match_App_Store.mobileprovision',
  'p12_base64.txt',
  'pp_base64.txt',
  'CertificateSigningRequest.certSigningRequest',
];

try {
  const tracked = execFileSync('git', ['ls-files', '--', ...secretFiles], { cwd: root, encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (tracked.length) errors.push(`署名情報がGit追跡中です: ${tracked.join(', ')}`);
} catch {
  errors.push('Gitの署名情報チェックに失敗しました');
}

if (errors.length) {
  console.error('Release preflight failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Release preflight passed.');
