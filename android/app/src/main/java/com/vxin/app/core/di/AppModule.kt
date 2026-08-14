package com.vxin.app.core.di

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.vxin.app.core.network.AuthInterceptor
import com.vxin.app.core.network.HostSelectionInterceptor
import com.vxin.app.core.storage.ServerConfig
import com.vxin.app.data.api.AuthApi
import com.vxin.app.data.api.ContactApi
import com.vxin.app.data.api.GroupApi
import com.vxin.app.data.api.MessageApi
import com.vxin.app.data.api.NotificationApi
import com.vxin.app.data.api.SearchApi
import com.vxin.app.data.api.StickerApi
import com.vxin.app.data.api.UserApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class AppScope

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    @AppScope
    fun provideAppScope(): CoroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        // partial-update 关键：null 字段不编码（省略）。否则后端 normalizeSettings 以
        // `body[k] !== undefined` 判定，会把 JSON null 当 false，改一个开关就误关其它所有开关。
        explicitNulls = false
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        hostSelectionInterceptor: HostSelectionInterceptor,
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        // ── 证书固定（防中间人攻击 MITM）───────────────────────────
        // 使用 Public Key Pinning，证书续期时 key 不变无需更新 App。
        // TODO: 上线前配置证书固定（Certificate Pinning）
        // 需要添加 okhttp3.CertificatePinner 并填入真实 SHA256 hash
        return OkHttpClient.Builder()
            // 超时:默认仅 10s,弱网/大文件(分片上传单片、视频、二维码下载)必触发 SocketTimeout。
            // 连接 20s;读写 60s 容纳慢上传/下载;callTimeout=0 不设总时长上限,靠读写超时兜底。
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .callTimeout(0, TimeUnit.SECONDS)
            // ── 连接池优化：复用 TCP 连接，减少握手开销 ──────────────
            // maxIdleConnections=10：同时保持 10 个空闲 TCP（大群聊+通话同时进行时够用）。
            // keepAliveDuration=5min：对齐服务端 keep-alive，5分钟内不重建。
            .connectionPool(ConnectionPool(10, 5, TimeUnit.MINUTES))
            // ── HTTP/2 优先（多路复用，单连接并发多请求）─────────────
            // OkHttp 默认支持 HTTP/2，这里显式声明优先级（HTTP_2 先于 HTTP_1_1）。
            .protocols(listOf(Protocol.HTTP_2, Protocol.HTTP_1_1))
            // ── 重试（弱网连接失败时自动切 IP）─────────────────────
            .retryOnConnectionFailure(true)
            .addInterceptor(hostSelectionInterceptor)
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .build()
    }

    @OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)
    @Provides
    @Singleton
    fun provideRetrofit(
        client: OkHttpClient,
        json: Json,
        serverConfig: ServerConfig,
    ): Retrofit {
        android.util.Log.d("LOGIN_DIAG", "provideRetrofit baseUrl=${serverConfig.baseUrlWithSlash()}")
        // 注意：使用 retrofit2-kotlinx-serialization-converter 的 asConverterFactory。
        // 该 converter 依赖 Retrofit CallAdapter 层先解包 suspend 函数的返回类型。
        // 对于 suspend fun login(...): AuthResponse，Retrofit 在调用 Converter.Factory
        // 时传入的 Type 是 AuthResponse.class（裸 Class），而非 ParameterizedType。
        // 这与 converter 内部 SerializersKt.serializer(module, Type) 的调用路径兼容，
        // 只要 Signature 属性在 R8 构建后仍然保留（已由 -keepattributes Signature 确保）。
        // 如果运行时出现 ClassCastException: Class → ParameterizedType，
        // 根因是 Retrofit 2.9.0 的 suspend 适配器向 converter 传入了原始 Class 而非泛型 Type。
        // 修复：在 Retrofit.Builder 中不显式设置 callFactory，让默认的 SuspendResponseConverter
        // 正确处理 suspend 函数的返回类型解包。
        return Retrofit.Builder()
            .baseUrl(serverConfig.baseUrlWithSlash())
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

    @Provides
    @Singleton
    fun provideMessageApi(retrofit: Retrofit): MessageApi = retrofit.create(MessageApi::class.java)

    @Provides
    @Singleton
    fun provideNotificationApi(retrofit: Retrofit): NotificationApi = retrofit.create(NotificationApi::class.java)

    @Provides
    @Singleton
    fun provideContactApi(retrofit: Retrofit): ContactApi = retrofit.create(ContactApi::class.java)

    @Provides
    @Singleton
    fun provideUserApi(retrofit: Retrofit): UserApi = retrofit.create(UserApi::class.java)

    @Provides
    @Singleton
    fun provideConfigApi(retrofit: Retrofit): com.vxin.app.data.api.ConfigApi =
        retrofit.create(com.vxin.app.data.api.ConfigApi::class.java)

    @Provides
    @Singleton
    fun provideGroupApi(retrofit: Retrofit): GroupApi = retrofit.create(GroupApi::class.java)

    @Provides
    @Singleton
    fun provideSearchApi(retrofit: Retrofit): SearchApi = retrofit.create(SearchApi::class.java)

    @Provides
    @Singleton
    fun provideStickerApi(retrofit: Retrofit): StickerApi = retrofit.create(StickerApi::class.java)

    @Provides
    @Singleton
    fun provideWalletApi(retrofit: Retrofit): com.vxin.app.data.api.WalletApi =
        retrofit.create(com.vxin.app.data.api.WalletApi::class.java)

    @Provides
    @Singleton
    fun provideFriendLabelApi(retrofit: Retrofit): com.vxin.app.data.api.FriendLabelApi =
        retrofit.create(com.vxin.app.data.api.FriendLabelApi::class.java)

    @Provides
    @Singleton
    fun provideRedPacketApi(retrofit: Retrofit): com.vxin.app.data.api.RedPacketApi =
        retrofit.create(com.vxin.app.data.api.RedPacketApi::class.java)

    @Provides
    @Singleton
    fun provideTurnApi(retrofit: Retrofit): com.vxin.app.data.api.TurnApi =
        retrofit.create(com.vxin.app.data.api.TurnApi::class.java)

    @Provides
    @Singleton
    fun provideFavoritesApi(retrofit: Retrofit): com.vxin.app.data.api.FavoritesApi =
        retrofit.create(com.vxin.app.data.api.FavoritesApi::class.java)

    @Provides
    @Singleton
    fun provideMomentApi(retrofit: Retrofit): com.vxin.app.data.api.MomentApi =
        retrofit.create(com.vxin.app.data.api.MomentApi::class.java)
}
