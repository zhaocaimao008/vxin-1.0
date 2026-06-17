import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { SocketProvider } from './src/contexts/SocketContext';
import { CallProvider } from './src/contexts/CallContext';
import AppNavigator from './src/navigation/AppNavigator';

class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <Text style={styles.errorTitle}>启动失败</Text>
          <Text style={styles.errorText}>{String(this.state.error?.message || this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <SocketProvider>
            <CallProvider>
              <AppNavigator />
            </CallProvider>
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F7F8FA',
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FA5151',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2D3D',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#7A8694',
    lineHeight: 20,
    textAlign: 'center',
  },
});
