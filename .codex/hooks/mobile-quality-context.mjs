#!/usr/bin/env node

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let event = {};
try {
  event = JSON.parse(raw || '{}');
} catch {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const prompt = String(event.prompt || '');
const mobile = /(ios|iphone|ipad|android|mobile|スマホ|モバイル|アプリ)/i.test(prompt);
const quality = /(bug|crash|regression|qa|test|audit|release|不具合|バグ|クラッシュ|テスト|監査|審査|リリース|動かない|止まる)/i.test(prompt);

if (!mobile || !quality) {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  continue: true,
  hookSpecificOutput: {
    hookEventName: 'UserPromptSubmit',
    additionalContext: 'This request concerns mobile-game quality. Use $mobile-game-quality-audit when available. Trace deliberate app stop paths and native lifecycle/error callbacks separately; audit iOS, Android, shared state/networking, packaged build identity, and test coverage. Do not claim full coverage without recording which native builds, simulators, real devices, and store-track artifacts were exercised.'
  }
}));
