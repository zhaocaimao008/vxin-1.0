import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

const C = {
  nav: '#1A2033',
  green: '#07C160',
  bg: '#F7F8FA',
  bgCard: '#FFFFFF',
  text: '#1F2D3D',
  textSub: '#7A8694',
  border: '#E8ECF0',
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card: C.bgCard,
    text: C.text,
    border: C.border,
    primary: C.green,
  },
};

// --- SVG-style View-based tab icons ---
function IconMessages({ color, size }) {
  const s = size || 24;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: s * 0.88,
        height: s * 0.75,
        borderRadius: s * 0.18,
        borderWidth: 1.8,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {[0,1,2].map(i => (
            <View key={i} style={{ width: s * 0.1, height: s * 0.1, borderRadius: s * 0.05, backgroundColor: color }} />
          ))}
        </View>
      </View>
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: s * 0.1,
        width: s * 0.22,
        height: s * 0.18,
        borderRightWidth: 1.8,
        borderBottomWidth: 1.8,
        borderColor: color,
        transform: [{ rotate: '15deg' }],
      }} />
    </View>
  );
}

function IconContacts({ color, size }) {
  const s = size || 24;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      {/* Two person silhouettes */}
      <View style={{ position: 'absolute', right: 2 }}>
        <View style={{
          width: s * 0.38,
          height: s * 0.38,
          borderRadius: s * 0.19,
          borderWidth: 1.6,
          borderColor: color,
          opacity: 0.7,
        }} />
        <View style={{
          width: s * 0.48,
          height: s * 0.28,
          borderRadius: s * 0.1,
          borderWidth: 1.6,
          borderColor: color,
          borderBottomWidth: 0,
          marginTop: 1,
          opacity: 0.7,
        }} />
      </View>
      <View style={{ position: 'absolute', left: 0, bottom: 2 }}>
        <View style={{
          width: s * 0.4,
          height: s * 0.4,
          borderRadius: s * 0.2,
          borderWidth: 1.8,
          borderColor: color,
        }} />
        <View style={{
          width: s * 0.52,
          height: s * 0.28,
          borderRadius: s * 0.1,
          borderWidth: 1.8,
          borderColor: color,
          borderBottomWidth: 0,
          marginTop: 1,
        }} />
      </View>
    </View>
  );
}

function IconProfile({ color, size }) {
  const s = size || 24;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: s * 0.44,
        height: s * 0.44,
        borderRadius: s * 0.22,
        borderWidth: 1.8,
        borderColor: color,
        marginBottom: 2,
      }} />
      <View style={{
        width: s * 0.78,
        height: s * 0.32,
        borderTopLeftRadius: s * 0.18,
        borderTopRightRadius: s * 0.18,
        borderWidth: 1.8,
        borderBottomWidth: 0,
        borderColor: color,
      }} />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.green,
        tabBarInactiveTintColor: C.textSub,
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopColor: C.border,
          borderTopWidth: 0.5,
          height: 56,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{
          title: '消息',
          tabBarIcon: ({ color, size }) => <IconMessages color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          title: '通讯录',
          tabBarIcon: ({ color, size }) => <IconContacts color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: '我',
          tabBarIcon: ({ color, size }) => <IconProfile color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: C.bgCard,
          },
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 17,
            color: C.text,
          },
          headerTintColor: C.text,
          contentStyle: {
            backgroundColor: C.bg,
          },
          headerBackTitleVisible: false,
        }}
      >
        {user ? (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({
                title: route.params?.conversation?.name || '聊天',
                headerStyle: { backgroundColor: C.bgCard },
              })}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: '设置' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{
                title: '注册账号',
                headerStyle: { backgroundColor: C.bgCard },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({});
