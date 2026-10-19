'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { patchPackage, patchSource, originalSource, SOURCE_PATH, VERSION } = require('./patch-android-notifications.cjs');

const dependency = path.resolve(__dirname, '../node_modules/@capacitor/local-notifications');
const installedSource = () => fs.readFileSync(path.join(dependency, SOURCE_PATH), 'utf8');

function temporaryDirectory(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kotodama-notifications-'));
    t.after(() => {
        const resolved = path.resolve(directory);
        assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
        assert.ok(path.basename(resolved).startsWith('kotodama-notifications-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    });
    return directory;
}

test('notification patch applies to the pinned package and is idempotent', t => {
    const directory = temporaryDirectory(t);
    const target = path.join(directory, SOURCE_PATH);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ version: VERSION }));
    const original = originalSource(installedSource());
    fs.writeFileSync(target, original);
    assert.equal(patchPackage(directory), true);
    assert.equal(fs.readFileSync(target, 'utf8'), patchSource(original));
    assert.equal(patchPackage(directory), false);
    assert.equal(originalSource(fs.readFileSync(target, 'utf8')), original);
});

test('notification patch refuses changed upstream code or a different version', t => {
    const original = originalSource(installedSource());
    assert.throws(() => patchSource(original + '// changed upstream\n'), /patch:/);
    assert.throws(() => patchSource(patchSource(original) + '// changed patched source\n'), /hash changed/);
    const directory = temporaryDirectory(t);
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ version: '8.0.1' }));
    assert.throws(() => patchPackage(directory), /supports 8\.0\.0/);
});

test('installed Android receiver contains the verified fix used by the build', () => {
    const source = installedSource();
    assert.equal(source, patchSource(source), 'Run node scripts/patch-android-notifications.cjs before building.');
});

// These fakes record Android API calls; they do not simulate Doze or delivery.
// Compile and execute the actual dependency receiver, not a copied algorithm.
const stubs = {
    'android/os/Build.java': `package android.os;
public class Build {
  public static class VERSION { public static int SDK_INT = 36; }
  public static class VERSION_CODES { public static final int S = 31, TIRAMISU = 33; }
}`,
    'android/app/Notification.java': `package android.app;
public class Notification { public long when; }`,
    'android/app/NotificationManager.java': `package android.app;
public class NotificationManager {
  public int count, lastId; public Notification last;
  public void notify(int id, Notification notification) { count++; lastId=id; last=notification; }
}`,
    'android/app/AlarmManager.java': `package android.app;
public class AlarmManager {
  public static final int RTC_WAKEUP = 0, RTC = 1;
  public boolean exactAllowed; public int count, type; public long trigger; public String method;
  public PendingIntent pending;
  public boolean canScheduleExactAlarms() { return exactAllowed; }
  private void record(String name, int kind, long time, PendingIntent pi) {
    count++; method=name; type=kind; trigger=time; pending=pi;
  }
  public void set(int t,long at,PendingIntent p) { record("set",t,at,p); }
  public void setExact(int t,long at,PendingIntent p) { record("setExact",t,at,p); }
  public void setAndAllowWhileIdle(int t,long at,PendingIntent p) { record("setAndAllowWhileIdle",t,at,p); }
  public void setExactAndAllowWhileIdle(int t,long at,PendingIntent p) { record("setExactAndAllowWhileIdle",t,at,p); }
}`,
    'android/app/PendingIntent.java': `package android.app;
import android.content.Context; import android.content.Intent;
public class PendingIntent {
  public static final int FLAG_CANCEL_CURRENT = 1, FLAG_MUTABLE = 2;
  public int requestCode; public Intent intent;
  public static PendingIntent getBroadcast(Context c,int id,Intent intent,int flags) {
    PendingIntent p=new PendingIntent(); p.requestCode=id; p.intent=intent; return p;
  }
}`,
    'android/content/Context.java': `package android.content;
import android.app.AlarmManager; import android.app.NotificationManager;
public class Context {
  public static final String NOTIFICATION_SERVICE="notification", ALARM_SERVICE="alarm";
  public final AlarmManager alarms=new AlarmManager();
  public final NotificationManager notifications=new NotificationManager();
  public Object getSystemService(String name) { return ALARM_SERVICE.equals(name)?alarms:notifications; }
}`,
    'android/content/Intent.java': `package android.content;
import java.util.HashMap; import java.util.Map;
public class Intent implements Cloneable {
  private final Map<String,Object> extras=new HashMap<>();
  public Intent putExtra(String key,Object value) { extras.put(key,value); return this; }
  public int getIntExtra(String key,int fallback) { Object x=extras.get(key); return x instanceof Integer?(Integer)x:fallback; }
  public String getStringExtra(String key) { return (String)extras.get(key); }
  public <T> T getParcelableExtra(String key,Class<T> type) { return type.cast(extras.get(key)); }
  @SuppressWarnings("unchecked") public <T> T getParcelableExtra(String key) { return (T)extras.get(key); }
  public Object clone() { Intent i=new Intent(); i.extras.putAll(extras); return i; }
}`,
    'android/content/BroadcastReceiver.java': `package android.content;
public abstract class BroadcastReceiver { public abstract void onReceive(Context context,Intent intent); }`,
    'com/getcapacitor/JSObject.java': `package com.getcapacitor; public class JSObject {}`,
    'com/getcapacitor/Logger.java': `package com.getcapacitor;
public class Logger {
  public static String tags(String value) { return value; }
  public static void error(String t,String m,Exception e) {}
  public static void warn(String t,String m) {} public static void debug(String t,String m) {}
}`,
    'com/capacitorjs/plugins/localnotifications/DateMatch.java': `package com.capacitorjs.plugins.localnotifications;
import java.util.Date;
public class DateMatch {
  public static DateMatch fromMatchString(String value) { return new DateMatch(); }
  public long nextTrigger(Date now) { return 1234567890000L; }
}`,
    'com/capacitorjs/plugins/localnotifications/LocalNotificationSchedule.java': `package com.capacitorjs.plugins.localnotifications;
public class LocalNotificationSchedule {
  private final boolean idle; public LocalNotificationSchedule(boolean idle) { this.idle=idle; }
  public boolean allowWhileIdle() { return idle; }
}`,
    'com/capacitorjs/plugins/localnotifications/LocalNotification.java': `package com.capacitorjs.plugins.localnotifications;
public class LocalNotification {
  private final LocalNotificationSchedule schedule;
  public LocalNotification(LocalNotificationSchedule schedule) { this.schedule=schedule; }
  public LocalNotificationSchedule getSchedule() { return schedule; }
}`,
    'com/capacitorjs/plugins/localnotifications/NotificationStorage.java': `package com.capacitorjs.plugins.localnotifications;
import android.content.Context; import com.getcapacitor.JSObject;
public class NotificationStorage {
  public static LocalNotification saved; public static String deleted;
  public NotificationStorage(Context context) {}
  public LocalNotification getSavedNotification(String id) { return saved; }
  public JSObject getSavedNotificationAsJSObject(String id) { return new JSObject(); }
  public void deleteNotification(String id) { deleted=id; }
}`,
    'com/capacitorjs/plugins/localnotifications/LocalNotificationManager.java': `package com.capacitorjs.plugins.localnotifications;
public class LocalNotificationManager { public static final String NOTIFICATION_INTENT_KEY="id"; }`,
    'com/capacitorjs/plugins/localnotifications/LocalNotificationsPlugin.java': `package com.capacitorjs.plugins.localnotifications;
import com.getcapacitor.JSObject;
public class LocalNotificationsPlugin { public static void fireReceived(JSObject object) {} }`,
    'com/capacitorjs/plugins/localnotifications/ReceiverRegression.java': `package com.capacitorjs.plugins.localnotifications;
import android.app.*; import android.content.*; import android.os.Build;
public class ReceiverRegression {
  private static void check(boolean ok,String message) { if(!ok) throw new AssertionError(message); }
  private static Intent notificationIntent(boolean cron) {
    Intent intent=new Intent().putExtra(LocalNotificationManager.NOTIFICATION_INTENT_KEY,1200)
      .putExtra(TimedNotificationPublisher.NOTIFICATION_KEY,new Notification());
    if(cron) intent.putExtra(TimedNotificationPublisher.CRON_KEY,"11:59");
    return intent;
  }
  public static void main(String[] args) {
    int checked=0;
    for(int api:new int[]{24,30,31,36}) for(boolean exact:new boolean[]{true,false})
      for(boolean idle:new boolean[]{true,false}) {
        Build.VERSION.SDK_INT=api;
        Context context=new Context(); context.alarms.exactAllowed=exact;
        NotificationStorage.saved=new LocalNotification(new LocalNotificationSchedule(idle));
        NotificationStorage.deleted=null;
        Intent current=notificationIntent(true); // No newly-added extras: also models an old app's pending intent.
        String expected=(api<31||exact)?(idle?"setExactAndAllowWhileIdle":"setExact")
          :(idle?"setAndAllowWhileIdle":"set");
        for(int repeat=1;repeat<=3;repeat++) {
          new TimedNotificationPublisher().onReceive(context,current);
          check(expected.equals(context.alarms.method),"API="+api+", exact="+exact+", idle="+idle
            +", recurrence="+repeat+": expected "+expected+", got "+context.alarms.method);
          check(context.alarms.type==(idle?AlarmManager.RTC_WAKEUP:AlarmManager.RTC),"wrong wakeup type");
          check(context.alarms.trigger==1234567890000L,"wrong trigger");
          check(context.alarms.pending.requestCode==1200,"notification identity changed");
          check(context.notifications.count==repeat,"notification not presented once");
          check(NotificationStorage.deleted==null,"repeating notification was deleted");
          current=context.alarms.pending.intent; checked++;
        }
      }
    Context missing=new Context(); missing.alarms.exactAllowed=true;
    NotificationStorage.saved=null;
    new TimedNotificationPublisher().onReceive(missing,notificationIntent(true));
    check("setExact".equals(missing.alarms.method),"missing metadata must retain ordinary scheduling");
    NotificationStorage.saved=new LocalNotification(null);
    new TimedNotificationPublisher().onReceive(missing,notificationIntent(true));
    check("setExact".equals(missing.alarms.method),"missing schedule must retain ordinary scheduling");
    Context once=new Context(); NotificationStorage.deleted=null;
    new TimedNotificationPublisher().onReceive(once,notificationIntent(false));
    check(once.alarms.count==0,"one-shot notification was rescheduled");
    check("1200".equals(NotificationStorage.deleted),"one-shot storage was not cleaned");
    System.out.println("PASS actual receiver: "+checked+" recurring deliveries; legacy intent, missing metadata, one-shot cleanup");
  }
}`,
};

function javaCommand(name) {
    return process.env.JAVA_HOME
        ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? `${name}.exe` : name)
        : name;
}

test('actual Java receiver preserves idle policy across repeated deliveries and legacy pending intents', t => {
    const java = javaCommand('java');
    const javac = javaCommand('javac');
    const available = spawnSync(javac, ['-version'], { encoding: 'utf8', windowsHide: true });
    if (available.error || available.status !== 0) {
        assert.ok(!process.env.CI, 'Java is required for this regression in CI. Set up Java before npm test.');
        t.skip('JDK unavailable: Android API dispatch is not verified locally; run with JAVA_HOME (CI uses Java 21).');
        return;
    }
    const directory = temporaryDirectory(t);
    const sourceRoot = path.join(directory, 'src');
    const files = [];
    for (const [relative, source] of Object.entries(stubs)) {
        const filename = path.join(sourceRoot, relative);
        fs.mkdirSync(path.dirname(filename), { recursive: true });
        fs.writeFileSync(filename, source);
        files.push(filename);
    }
    const receiver = path.join(sourceRoot, 'com/capacitorjs/plugins/localnotifications/TimedNotificationPublisher.java');
    files.push(receiver);
    const original = originalSource(installedSource());
    function runReceiver(source, label) {
        fs.writeFileSync(receiver, source);
        const classes = path.join(directory, label);
        fs.mkdirSync(classes);
        const compiled = spawnSync(javac, ['-encoding', 'UTF-8', '-d', classes, ...files],
            { encoding: 'utf8', windowsHide: true, timeout: 30000 });
        assert.equal(compiled.status, 0, compiled.error?.message || compiled.stdout + compiled.stderr);
        return spawnSync(java, ['-cp', classes, 'com.capacitorjs.plugins.localnotifications.ReceiverRegression'],
            { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    }
    const before = runReceiver(original, 'before');
    assert.notEqual(before.status, 0, 'The regression must expose the unpatched upstream defect.');
    assert.match(before.stderr, /expected setExactAndAllowWhileIdle, got setExact/);
    const after = runReceiver(installedSource(), 'after');
    assert.equal(after.status, 0, after.error?.message || after.stdout + after.stderr);
    assert.match(after.stdout, /PASS actual receiver: 48 recurring deliveries/);
    t.diagnostic(after.stdout.trim());
});
