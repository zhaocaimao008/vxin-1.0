import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AuthProvider } from './src/contexts/AuthContext';
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
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F5F5F5',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#191919',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  }
});
