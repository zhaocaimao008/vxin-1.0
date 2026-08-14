# ══════════════════════════════════════════════════════════════════════════════
# v信 Android 8.0.1 — 完整 ProGuard / R8 规则
# 根因修复：原规则只有10行，导致 Hilt/Socket.IO/Serialization 等关键类被R8删除
# 从而引发白屏闪退 (IllegalStateException / ClassNotFoundException)
# ══════════════════════════════════════════════════════════════════════════════

# ── 全局属性保留 ─────────────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes Signature
-keepattributes Exceptions
-keepattributes SourceFile,LineNumberTable

# ── 1. Hilt DI（最关键：71个文件使用注入，R8删除生成类是白屏闪退主因）─────────
# Hilt 在编译期生成 Dagger_*、Hilt_* 组件类，R8 必须保留否则运行时找不到
-keep class dagger.hilt.** { *; }
-keep @dagger.hilt.android.HiltAndroidApp class * { *; }
-keep @dagger.hilt.android.AndroidEntryPoint class * { *; }
-keep @dagger.hilt.InstallIn class * { *; }
-keep @dagger.Module class * { *; }
-keepclassmembers class * {
    @dagger.hilt.** *;
    @javax.inject.** *;
    @dagger.** *;
}
-dontwarn dagger.**
-dontwarn javax.inject.**

# ── 2. Kotlin 协程 ────────────────────────────────────────────────────────────
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class ** {
    @kotlinx.coroutines.** *;
}
-dontwarn kotlinx.coroutines.**

# ── 3. kotlinx.serialization（@Serializable 数据模型）────────────────────────
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
# v信数据模型（完整保留，避免字段被混淆导致JSON反序列化失败）
-keep @kotlinx.serialization.Serializable class * { *; }
-keep class com.vxin.app.data.model.** { *; }
-keepclassmembers class com.vxin.app.data.model.** {
    *** Companion;
    <fields>;
}
-keepclasseswithmembers class com.vxin.app.data.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ── 4. Socket.IO 客户端（反射依赖，必须完整保留）────────────────────────────
-keep class io.socket.** { *; }
-keep interface io.socket.** { *; }
-dontwarn io.socket.**
# Engine.IO（Socket.IO底层）
-keep class io.socket.engineio.** { *; }
-keep class io.socket.client.** { *; }
# JSON.org（Socket.IO依赖）
-keep class org.json.** { *; }
-dontwarn org.json.**

# ── 5. OkHttp / Retrofit ─────────────────────────────────────────────────────
-keepattributes Signature, Exceptions
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class okio.** { *; }
-dontwarn okio.**
-keep class retrofit2.** { *; }
-keep interface retrofit2.** { *; }
-dontwarn retrofit2.**
# Retrofit 接口（动态代理）
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
# Kotlin suspend 函数协程支持
-keepclassmembers class * {
    @retrofit2.http.* public <methods>;
}

# ── 6. Coil 图片加载 ──────────────────────────────────────────────────────────
-keep class coil.** { *; }
-dontwarn coil.**

# ── 7. WebRTC ────────────────────────────────────────────────────────────────
-keep class org.webrtc.** { *; }
-keep interface org.webrtc.** { *; }
-dontwarn org.webrtc.**

# ── 8. 个推 GeTui SDK ────────────────────────────────────────────────────────
-keep class com.igexin.** { *; }
-keep interface com.igexin.** { *; }
-dontwarn com.igexin.**

# ── 9. Firebase ──────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.firebase.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── 10. Kotlin Reflect ───────────────────────────────────────────────────────
-keep class kotlin.Metadata { *; }
-keep class kotlin.reflect.** { *; }
-dontwarn kotlin.reflect.jvm.internal.**

# ── 11. Jetpack Compose ──────────────────────────────────────────────────────
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**

# ── 12. Jetpack Navigation（Compose Navigation 使用反射）────────────────────
-keep class androidx.navigation.** { *; }
-dontwarn androidx.navigation.**

# ── 13. Security Crypto（EncryptedSharedPreferences）───────────────────────
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

# ── 14. Material3 ────────────────────────────────────────────────────────────
-dontwarn com.google.android.material.**

# ── 15. Lifecycle ─────────────────────────────────────────────────────────────
-keep class androidx.lifecycle.** { *; }
-dontwarn androidx.lifecycle.**

# ── 16. Activity Compose ─────────────────────────────────────────────────────
-keep class androidx.activity.** { *; }
-dontwarn androidx.activity.**

# ── 17. 通用 Android 枚举保护 ───────────────────────────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── 18. Serializable / Parcelable ────────────────────────────────────────────
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}
-keep class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# ── 19. ViewModel / ViewModel 工厂 ───────────────────────────────────────────
-keep class * extends androidx.lifecycle.ViewModel { *; }
-keep class * extends androidx.lifecycle.AndroidViewModel { *; }
-keepclassmembers class * extends androidx.lifecycle.ViewModel {
    <init>(...);
}

# ── 20. R8 通用 dontwarn ────────────────────────────────────────────────────
-dontwarn sun.misc.**
-dontwarn java.lang.invoke.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn afu.org.checkerframework.**
-dontwarn org.checkerframework.**

# ── 21. v信 Application / MainActivity（保留入口点）────────────────────────
-keep class com.vxin.app.VxinApp { *; }
-keep class com.vxin.app.MainActivity { *; }

# ── 22. 调试信息（便于真机崩溃时 Crashlytics/Logcat 可读 Stack Trace）────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── 3b. kotlinx.serialization Companion.serializer() — JetBrains 官方规则 ────
# 根因修复：R8 删除了 @Serializable 类的 Companion.serializer() 方法，
# 导致 Retrofit 转换器无法找到序列化器 → SerializationException → "登录失败"
# 来源：https://github.com/Kotlin/kotlinx.serialization/blob/master/rules/common.pro

# 保留所有 @Serializable 类的 Companion 对象引用
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}

# 保留 Companion 对象上的 serializer(...) 方法（Retrofit 通过此方法获取序列化器）
-if @kotlinx.serialization.Serializable class ** {
    static ** Companion;
}
-keepclassmembers class <2> {
    kotlinx.serialization.KSerializer serializer(...);
}

# 保留 object 类型的 @Serializable 类的 serializer()
-if @kotlinx.serialization.Serializable class ** {
    public static ** INSTANCE;
}
-keepclassmembers class <1> {
    public static ** INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}

# 保留 $$serializer 生成类（compile-time 生成，包含 descriptor）
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1>$$serializer {
    static <1>$$serializer INSTANCE;
    kotlinx.serialization.descriptors.SerialDescriptor descriptor;
}
