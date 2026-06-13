import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SocketProvider } from './contexts/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ElectronTitlebar from './components/ElectronTitlebar';

// Electron 使用 HashRouter（file:// 不支持 pushState）；Web 用 BrowserRouter
const Router = window.__ELECTRON_CONFIG__ ? HashRouter : BrowserRouter;

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>加载中...</div>;
  return user ? children : <Navigate to="/login" />;
};

export default function App() {
  const isElectron = !!window.__ELECTRON_CONFIG__;
  return (
    <SettingsProvider>
    <AuthProvider>
      {isElectron && <ElectronTitlebar />}
      <div style={isElectron ? { paddingTop: 30, height: '100vh', boxSizing: 'border-box', overflow: 'hidden' } : {}}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/*" element={
              <PrivateRoute>
                <SocketProvider>
                  <Home />
                </SocketProvider>
              </PrivateRoute>
            } />
          </Routes>
        </Router>
      </div>
    </AuthProvider>
    </SettingsProvider>
  );
}
