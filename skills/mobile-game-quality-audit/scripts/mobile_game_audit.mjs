#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const requestedRoot = process.argv.find((value, index) => index > 1 && !value.startsWith('--'));
const jsonOutput = process.argv.includes('--json');
const strict = process.argv.includes('--strict');
const root = path.resolve(requestedRoot || process.cwd());
const findings = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function add(level, area, message, evidence = '') {
  findings.push({ level, area, message, evidence });
}

function hash(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');
}

const packageSource = read('package.json');
const packageJson = packageSource ? JSON.parse(packageSource) : null;
const capacitorSource = read('capacitor.config.json') || read('capacitor.config.ts');
const gradleSource = read('android/app/build.gradle');
const androidManifest = read('android/app/src/main/AndroidManifest.xml');
const androidSpeech = read('android/app/src/main/java/com/kotodamamatch/app/SpeechRecognitionPlugin.java');
const iosProject = read('ios/App/App.xcodeproj/project.pbxproj');
const iosInfo = read('ios/App/App/Info.plist');
const iosPackage = read('ios/App/CapApp-SPM/Package.swift');
const swiftFiles = [];

function collectFiles(directory, extension, output) {
  const absoluteDirectory = path.join(root, directory);
  if (!fs.existsSync(absoluteDirectory)) return;
  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const child = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) collectFiles(path.relative(root, child), extension, output);
    else if (entry.name.endsWith(extension)) output.push(fs.readFileSync(child, 'utf8'));
  }
}

collectFiles('ios', '.swift', swiftFiles);
collectFiles('plugins', '.swift', swiftFiles);
const allSwift = swiftFiles.join('\n');
const mainJs = read('main.js');
const indexHtml = read('index.html');
const styleCss = read('style.css');
const allJs = [mainJs, read('data.js'), read('noon-ritual.js')].join('\n');
const workflowFiles = [];
collectFiles('.github/workflows', '.yml', workflowFiles);
collectFiles('.github/workflows', '.yaml', workflowFiles);
const workflows = workflowFiles.join('\n');

if (!packageJson && !exists('android') && !exists('ios')) {
  add('FAIL', 'repository', 'No package.json, android/, or ios/ project was found.', root);
}

const appIdMatch = capacitorSource.match(/(?:appId["']?\s*[:=]\s*["'])([^"']+)/);
const applicationIdMatch = gradleSource.match(/applicationId\s+["']([^"']+)/);
const appId = appIdMatch?.[1] || applicationIdMatch?.[1] || '';
if (appId) add('PASS', 'identity', `Application ID detected: ${appId}`);

const versions = [];
if (packageJson?.version) versions.push(['package.json', packageJson.version]);
const gradleVersion = gradleSource.match(/versionName\([^\n]*?\?:\s*["']([^"']+)/)?.[1]
  || gradleSource.match(/versionName\s+["']([^"']+)/)?.[1];
if (gradleVersion) versions.push(['Android default', gradleVersion]);
for (const match of iosProject.matchAll(/MARKETING_VERSION\s*=\s*([^;\s]+)/g)) versions.push(['iOS', match[1]]);
const uniqueVersions = new Set(versions.map(([, version]) => version));
if (uniqueVersions.size > 1) add('WARN', 'identity', `Version values differ: ${versions.map(([source, value]) => `${source}=${value}`).join(', ')}`);
else if (versions.length) add('PASS', 'identity', `Version values agree: ${[...uniqueVersions][0]}`);

for (const asset of ['main.js', 'style.css', 'index.html']) {
  const copies = ['www', 'android/app/src/main/assets/public', 'ios/App/App/public']
    .map((directory) => `${directory}/${asset}`)
    .filter(exists);
  for (const copy of copies) {
    if (hash(copy) === hash(asset)) add('PASS', 'packaging', `${asset} matches ${copy}.`);
    else add('FAIL', 'packaging', `${asset} differs from ${copy}; a native build may package stale code.`, `${asset}, ${copy}`);
  }
}

if (/SpeechRecognizer|RECORD_AUDIO/.test(androidSpeech + androidManifest)) {
  if (/android\.permission\.RECORD_AUDIO/.test(androidManifest)) add('PASS', 'android speech', 'RECORD_AUDIO is declared.');
  else add('FAIL', 'android speech', 'Speech recognition is used without RECORD_AUDIO in the manifest.');
  if (/ERROR_CLIENT/.test(androidSpeech) && /ERROR_TOO_MANY_REQUESTS/.test(androidSpeech)) {
    add('PASS', 'android speech', 'Client and rate-limit recognition errors are classified explicitly.');
  } else {
    add('WARN', 'android speech', 'Review ERROR_CLIENT and ERROR_TOO_MANY_REQUESTS as bounded transient restart cases.');
  }
  if (/onResults[\s\S]*?startListening|onResults[\s\S]*?scheduleRecognizerRestart/.test(androidSpeech)) {
    add('PASS', 'android speech', 'A final result has an explicit continuation path.');
  } else {
    add('WARN', 'android speech', 'No obvious continuation path was found after a final Android speech result.');
  }
  if (/SessionRecognitionListener/.test(androidSpeech)
      && /recognitionSessionId\s*==\s*sessionId/.test(androidSpeech)
      && /destroyRecognizer\(\)[\s\S]*?recognitionSessionId\s*\+=\s*1/.test(androidSpeech)) {
    add('PASS', 'android speech', 'Recognition callbacks are scoped to the current session generation.');
  } else {
    add('WARN', 'android speech', 'Old SpeechRecognizer callbacks may be delivered into a newer session; use a listener that captures and checks its generation.');
  }
}

if (/FOREGROUND_SERVICE_TYPE_MICROPHONE|foregroundServiceType="microphone"/.test(androidManifest + androidSpeech)) {
  const hasFgs = /android\.permission\.FOREGROUND_SERVICE/.test(androidManifest);
  const hasMicFgs = /android\.permission\.FOREGROUND_SERVICE_MICROPHONE/.test(androidManifest);
  add(hasFgs && hasMicFgs ? 'PASS' : 'FAIL', 'android foreground service', 'Microphone foreground-service permissions and type must be declared together.');
}

if (/LocalNotifications|allowWhileIdle/.test(allJs) && exists('android')) {
  const hasExactPermission = /SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM/.test(androidManifest);
  const checksExactSetting = /checkExactNotificationSetting/.test(allJs);
  if (!hasExactPermission) add('WARN', 'android notifications', 'Scheduled notifications may be inexact because no exact-alarm permission is declared.');
  if (hasExactPermission && !checksExactSetting) add('WARN', 'android notifications', 'Exact-alarm permission is declared but the user setting is not checked in shared code.');
}

if (/android:allowBackup="true"/.test(androidManifest) && /localStorage[\s\S]*(token|speech|transcript|auth)/i.test(allJs)) {
  add('WARN', 'android privacy', 'Backups are enabled while local storage appears to contain tokens or speech-derived text; define extraction rules or disable backup.');
}

const androidTestSources = [];
collectFiles('android/app/src/androidTest', '.java', androidTestSources);
for (const source of androidTestSources) {
  const expectedPackage = source.match(/assertEquals\(["']([^"']+)["']\s*,\s*appContext\.getPackageName\(\)/)?.[1];
  if (appId && expectedPackage && expectedPackage !== appId) {
    add('FAIL', 'android tests', `Instrumentation test expects ${expectedPackage}, but the app ID is ${appId}.`);
  }
}

if (/SFSpeechRecognizer|AVAudioEngine/.test(allSwift)) {
  const hasMicReason = /NSMicrophoneUsageDescription/.test(iosInfo);
  const hasSpeechReason = /NSSpeechRecognitionUsageDescription/.test(iosInfo);
  add(hasMicReason && hasSpeechReason ? 'PASS' : 'FAIL', 'ios speech', 'Microphone and speech-recognition privacy strings must both be present.');
  if (/recognitionSessionId|generation/.test(allSwift)) add('PASS', 'ios speech', 'A session/generation marker exists for stale callback protection.');
  else add('WARN', 'ios speech', 'No session/generation marker was found; canceled callbacks may affect a newer recognition session.');
  if (/\[weak self, request\][\s\S]*?recognitionSessionId\s*==\s*sessionId[\s\S]*?request\.append\(buffer\)/.test(allSwift)) {
    add('PASS', 'ios speech', 'The audio tap appends only to its captured current-session request.');
  } else {
    add('WARN', 'ios speech', 'An old audio tap may append buffers to a newer recognition request.');
  }
}

if (/\.package\([^\n]*path:\s*"[^"\n]*\\/.test(iosPackage)) {
  add('FAIL', 'ios packaging', 'Package.swift contains Windows backslashes in a local package path; SwiftPM on macOS requires forward slashes.', 'ios/App/CapApp-SPM/Package.swift');
}

if (/function handleTutorialWordRecognized[\s\S]{0,500}stopMic\(\)/.test(mainJs)) {
  add('WARN', 'shared UX', 'The onboarding success path explicitly stops the microphone after the first recognized phrase.', 'main.js');
}

if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(indexHtml)
    || /gesturestart|touches\.length\s*>\s*1|function\s+preventViewportZoom/.test(mainJs)) {
  add('WARN', 'mobile accessibility', 'Global pinch zoom appears disabled; retain OS zoom and limit double-tap handling to controls.', 'index.html, main.js');
} else if (indexHtml) {
  add('PASS', 'mobile accessibility', 'No global pinch-zoom blocker was detected.');
}

const declaresLandscape = /UIInterfaceOrientationLandscape|screenOrientation\s*=\s*["'](?:landscape|sensorLandscape|fullSensor)/.test(iosInfo + androidManifest)
  || (exists('android') && !/screenOrientation\s*=/.test(androidManifest));
if (declaresLandscape && /overflow\s*:\s*hidden/.test(styleCss)) {
  if (/@media\s*\(orientation:\s*landscape\)[\s\S]*?max-height/.test(styleCss)) {
    add('PASS', 'mobile layout', 'A low-height landscape layout rule exists for a supported landscape orientation.');
  } else {
    add('WARN', 'mobile layout', 'Landscape is supported while root overflow is hidden, but no low-height landscape rule was found.');
  }
}

const iconOnlyButtons = [...indexHtml.matchAll(/<button\b([^>]*)>\s*(?:×|✕|✖|☰|⋮)\s*<\/button>/gi)]
  .filter((match) => !/(?:aria-label|title)\s*=/.test(match[1]));
if (iconOnlyButtons.length) add('WARN', 'mobile accessibility', `${iconOnlyButtons.length} icon-only button(s) lack an accessible name.`, 'index.html');

if (exists('package-lock.json') && /run:\s*npm install(?:\s|$)/.test(workflows)) {
  add('WARN', 'CI', 'A lockfile exists but CI uses npm install; use npm ci for deterministic validation.');
}
if (/continue-on-error:\s*true[\s\S]{0,160}?upload-artifact/i.test(workflows)) {
  add('WARN', 'CI', 'Artifact upload failures are allowed to pass, so a build can look successful without a downloadable artifact.');
}

if (exists('android') && workflows) {
  if (/gradlew[^\n]*(test|lint)|\.\/gradlew[^\n]*(test|lint)/.test(workflows)) add('PASS', 'CI', 'An Android test or lint task is present in CI.');
  else add('WARN', 'CI', 'Android CI builds artifacts but no Gradle test/lint task was detected.');
}
if (exists('ios') && workflows) {
  if (/xcodebuild[^\n]*test/.test(workflows)) add('PASS', 'CI', 'An iOS test action is present in CI.');
  else add('WARN', 'CI', 'iOS CI builds/archives but no xcodebuild test action was detected.');
}

const order = { FAIL: 0, WARN: 1, PASS: 2 };
findings.sort((left, right) => order[left.level] - order[right.level] || left.area.localeCompare(right.area));

if (jsonOutput) {
  process.stdout.write(`${JSON.stringify({ root, findings }, null, 2)}\n`);
} else {
  console.log(`# Mobile game audit: ${path.basename(root)}`);
  for (const finding of findings) {
    console.log(`- [${finding.level}] ${finding.area}: ${finding.message}${finding.evidence ? ` (${finding.evidence})` : ''}`);
  }
  console.log('\nStatic scan only. Native compilation, simulator/emulator, real-device, and store-track checks remain separate release gates.');
}

if (strict && findings.some((finding) => finding.level === 'FAIL')) process.exitCode = 1;
