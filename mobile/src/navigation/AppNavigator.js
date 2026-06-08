import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ icon, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: '#07C160', tabBarInactiveTintColor: '#8E8E93', tabBarStyle: { backgroundColor: 'rgba(247,247,247,0.86)', borderTopColor: 'rgba(210,214,220,0.75)', height: 58, paddingBottom: 6, paddingTop: 4 }, tabBarLabelStyle: { fontSize: 11 } }}>
      <Tab.Screen name="Chats" component={ChatListScreen} options={{ title: '微信', tabBarIcon: ({ focused }) => <TabIcon icon="💬" focused={focused} /> }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{ title: '通讯录', tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: '我', tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: 'rgba(247,247,247,0.9)' }, headerShadowVisible: false, headerTitleStyle: { fontWeight: '600', color: '#191919' }, headerTintColor: '#191919', contentStyle: { backgroundColor: '#EDEFF2' } }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params?.conversation?.name || '聊天' })} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: '注册' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
