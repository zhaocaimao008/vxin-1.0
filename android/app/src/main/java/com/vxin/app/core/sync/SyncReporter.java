// SyncReporter.java
// =================
// Background sync telemetry — batches events, posts to backend metrics endpoint

package com.vxin.app.core.sync;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.LinkedList;
import java.util.Queue;

public class SyncReporter {
    private static final String ENDPOINT = "https://dipsin.com/vx-stats";
    private static SyncReporter instance;

    private final Context ctx;
    private final String deviceId;
    private final Queue<JSONObject> buffer = new LinkedList<>();
    private static final int MAX_BUFFER = 50;
    private final Handler handler = new Handler(Looper.getMainLooper());

    public static synchronized SyncReporter get(Context context) {
        if (instance == null) instance = new SyncReporter(context.getApplicationContext());
        return instance;
    }

    private SyncReporter(Context context) {
        this.ctx = context;
        this.deviceId = Settings.Secure.getString(
            context.getContentResolver(), Settings.Secure.ANDROID_ID);
    }

    public void send(String type, JSONObject data) {
        try {
            JSONObject msg = new JSONObject();
            msg.put("uid", deviceId);
            msg.put("type", type);
            msg.put("ts", System.currentTimeMillis() / 1000);
            msg.put("src", "android");
            msg.put("device", Build.MODEL);
            msg.put("os", "Android " + Build.VERSION.RELEASE);
            msg.put("data", data);

            synchronized (buffer) {
                buffer.add(msg);
                if (buffer.size() >= MAX_BUFFER) {
                    flush();
                } else if (buffer.size() == 1) {
                    handler.postDelayed(this::flush, 5000);
                }
            }
        } catch (Exception ignored) {}
    }

    public void flush() {
        final JSONArray batch;
        synchronized (buffer) {
            if (buffer.isEmpty()) return;
            batch = new JSONArray(buffer);
            buffer.clear();
        }
        new Thread(() -> post(batch)).start();
    }

    private void post(JSONArray batch) {
        try {
            JSONObject envelope = new JSONObject();
            envelope.put("batch", batch);
            byte[] body = envelope.toString().getBytes("UTF-8");

            HttpURLConnection conn = (HttpURLConnection) new URL(ENDPOINT).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("User-Agent", "vxin/1.0");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setDoOutput(true);
            OutputStream os = conn.getOutputStream();
            os.write(body);
            os.flush();
            os.close();
            conn.getInputStream().close();
            conn.disconnect();
        } catch (Exception ignored) {}
    }
}
