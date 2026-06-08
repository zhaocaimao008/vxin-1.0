import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext({});

const FONT_SIZES = { small: 12, normal: 14, large: 16, xlarge: 18 };

export function SettingsProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('wc_dark') === '1');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('wc_font') || 'normal');
  const [notifySound, setNotifySound] = useState(() => localStorage.getItem('wc_notify') !== '0');

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('wc_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  useEffect(() => {
    const size = FONT_SIZES[fontSize] || 14;
    document.documentElement.style.setProperty('--font-msg', size + 'px');
    document.documentElement.style.setProperty('--font-name', (size) + 'px');
    document.documentElement.style.setProperty('--font-preview', (size - 2) + 'px');
    localStorage.setItem('wc_font', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('wc_notify', notifySound ? '1' : '0');
  }, [notifySound]);

  return (
    <SettingsContext.Provider value={{ darkMode, setDarkMode, fontSize, setFontSize, notifySound, setNotifySound }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
