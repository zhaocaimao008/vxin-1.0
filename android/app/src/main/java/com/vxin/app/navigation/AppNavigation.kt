package com.vxin.app.navigation

import android.net.Uri
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.vxin.app.core.auth.AuthState
import com.vxin.app.core.auth.SessionManager
import com.vxin.app.feature.auth.LoginScreen
import com.vxin.app.feature.auth.RegisterScreen
import com.vxin.app.feature.chat.ChatScreen
import com.vxin.app.feature.chat.ConversationListScreen
import com.vxin.app.feature.contacts.AddFriendScreen
import com.vxin.app.feature.contacts.ContactsScreen
import com.vxin.app.feature.contacts.CreateGroupScreen
import com.vxin.app.feature.contacts.FriendRequestsScreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class AppViewModel @Inject constructor(
    sessionManager: SessionManager,
) : ViewModel() {
    val authState: StateFlow<AuthState> = sessionManager.state
}

private object Routes {
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val CONVERSATIONS = "conversations"
    const val CONTACTS = "contacts"
    const val ADD_FRIEND = "addFriend"
    const val REQUESTS = "requests"
    const val CREATE_GROUP = "createGroup"
    const val CHAT = "chat/{conversationId}?title={title}"
    fun chat(conversationId: String, title: String) =
        "chat/$conversationId?title=${Uri.encode(title)}"
}

@Composable
fun AppNavigation(appViewModel: AppViewModel = hiltViewModel()) {
    val authState by appViewModel.authState.collectAsStateWithLifecycle()

    when (authState) {
        is AuthState.Loading -> SplashScreen()
        is AuthState.Authenticated -> MainFlow()
        is AuthState.Unauthenticated -> AuthFlow()
    }
}

@Composable
private fun AuthFlow() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = Routes.LOGIN) {
        composable(Routes.LOGIN) {
            LoginScreen(onNavigateRegister = { navController.navigate(Routes.REGISTER) })
        }
        composable(Routes.REGISTER) {
            RegisterScreen(onBack = { navController.popBackStack() })
        }
    }
}

@Composable
private fun MainFlow() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = Routes.CONVERSATIONS) {
        composable(Routes.CONVERSATIONS) {
            ConversationListScreen(
                onOpenConversation = { conv ->
                    navController.navigate(Routes.chat(conv.id, conv.name))
                },
                onOpenContacts = { navController.navigate(Routes.CONTACTS) },
            )
        }
        composable(Routes.CONTACTS) {
            ContactsScreen(
                onBack = { navController.popBackStack() },
                onOpenChat = { target -> navController.navigate(Routes.chat(target.conversationId, target.title)) },
                onAddFriend = { navController.navigate(Routes.ADD_FRIEND) },
                onRequests = { navController.navigate(Routes.REQUESTS) },
                onCreateGroup = { navController.navigate(Routes.CREATE_GROUP) },
            )
        }
        composable(Routes.ADD_FRIEND) {
            AddFriendScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.REQUESTS) {
            FriendRequestsScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.CREATE_GROUP) {
            CreateGroupScreen(
                onBack = { navController.popBackStack() },
                onCreated = { target ->
                    // 创建成功后回到会话列表再进入群聊（避免返回栈停在创建页）
                    navController.popBackStack(Routes.CONVERSATIONS, inclusive = false)
                    navController.navigate(Routes.chat(target.conversationId, target.title))
                },
            )
        }
        composable(
            route = Routes.CHAT,
            arguments = listOf(
                navArgument("conversationId") { type = NavType.StringType },
                navArgument("title") { type = NavType.StringType; defaultValue = "" },
            ),
        ) {
            ChatScreen(onBack = { navController.popBackStack() })
        }
    }
}

@Composable
private fun SplashScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}
