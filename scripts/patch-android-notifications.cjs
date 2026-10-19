'use strict';

// @capacitor/local-notifications 8.0.0 loses allowWhileIdle after the first
// cron delivery. Keep the upstream package pinned and fail closed if its source
// changes. This is run by postinstall, so npm ci restores the fix reproducibly.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const VERSION = '8.0.0';
const ORIGINAL_SHA256 = 'c6f39bf6e58524ff33f52d58c7ed72ff8b64d68b89c7c96d21c3c523352bc500';
const SOURCE_PATH = 'android/src/main/java/com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.java';
const edits = [
    {
        before: '            DateMatch date = DateMatch.fromMatchString(dateString);\n',
        after: '            DateMatch date = DateMatch.fromMatchString(dateString);\n'
            + '            // Kotodama: retain the saved idle policy for every recurrence,\n'
            + '            // including notifications scheduled before this app update.\n'
            + '            LocalNotification saved = new NotificationStorage(context).getSavedNotification(Integer.toString(id));\n'
            + '            LocalNotificationSchedule schedule = saved != null ? saved.getSchedule() : null;\n'
            + '            boolean allowWhileIdle = schedule != null && schedule.allowWhileIdle();\n',
    },
    {
        before: '                alarmManager.set(AlarmManager.RTC, trigger, pendingIntent);\n'
            + '            } else {\n'
            + '                alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent);\n',
        after: '                if (allowWhileIdle) {\n'
            + '                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent);\n'
            + '                } else {\n'
            + '                    alarmManager.set(AlarmManager.RTC, trigger, pendingIntent);\n'
            + '                }\n'
            + '            } else {\n'
            + '                if (allowWhileIdle) {\n'
            + '                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, pendingIntent);\n'
            + '                } else {\n'
            + '                    alarmManager.setExact(AlarmManager.RTC, trigger, pendingIntent);\n'
            + '                }\n',
    },
];

function hash(source) {
    return crypto.createHash('sha256').update(source).digest('hex');
}

function replaceOnce(source, from, to) {
    if (source.split(from).length !== 2) {
        throw new Error('Android notification patch: expected exactly one upstream block. Review the dependency before rebuilding.');
    }
    return source.replace(from, to);
}

function originalSource(source) {
    if (hash(source) === ORIGINAL_SHA256) return source;
    let original = source;
    for (const edit of [...edits].reverse()) original = replaceOnce(original, edit.after, edit.before);
    if (hash(original) !== ORIGINAL_SHA256) {
        throw new Error('Android notification patch: upstream source hash changed. Refusing to overwrite unknown changes.');
    }
    return original;
}

function patchSource(source) {
    let patched = originalSource(source);
    for (const edit of edits) patched = replaceOnce(patched, edit.before, edit.after);
    return patched;
}

function patchPackage(packageDirectory) {
    const metadata = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
    if (metadata.version !== VERSION) {
        throw new Error(`Android notification patch supports ${VERSION}, found ${metadata.version}. Review before changing versions.`);
    }
    const filename = path.join(packageDirectory, SOURCE_PATH);
    const source = fs.readFileSync(filename, 'utf8');
    const patched = patchSource(source);
    if (source !== patched) fs.writeFileSync(filename, patched, 'utf8');
    return source !== patched;
}

if (require.main === module) {
    try {
        const directory = path.resolve(__dirname, '../node_modules/@capacitor/local-notifications');
        const changed = patchPackage(directory);
        console.log(`Android notification repeat/idle fix: ${changed ? 'applied' : 'already verified'} (@capacitor/local-notifications ${VERSION}).`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = { patchPackage, patchSource, originalSource, SOURCE_PATH, VERSION, ORIGINAL_SHA256 };
