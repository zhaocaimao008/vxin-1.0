import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE } from '../config';

axios.defaults.baseURL = API_BASE;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('token');
      const u = await AsyncStorage.getItem('user');
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
        axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
      }
      setLoading(false);
    })();
  }, []);

  const login = async (tokenVal, userData) => {
    setToken(tokenVal);
    setUser(userData);
    await AsyncStorage.setItem('token', tokenVal);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${tokenVal}`;
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateUser = async (data) => {
    const updated = { ...user, ...data };
    setUser(updated);
    await AsyncStorage.setItem('user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
