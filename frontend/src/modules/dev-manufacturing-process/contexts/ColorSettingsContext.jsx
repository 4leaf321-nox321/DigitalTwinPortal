import React, { createContext, useContext, useState, useEffect } from 'react';

const DEFAULT_COLOR_ITEMS = [
  { color: '#3b82f6', label: '기획' },
  { color: '#8b5cf6', label: '설계' },
  { color: '#f59e0b', label: '검증' },
  { color: '#ef4444', label: '양산준비' },
  { color: '#10b981', label: '양산' },
];

const STORAGE_KEY = 'dev-manufacturing-process-colors';

const ColorSettingsContext = createContext(null);

export const ColorSettingsProvider = ({ children }) => {
  const [colorItems, setColorItems] = useState(() => {
    // localStorage에서 저장된 색상 불러오기
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 새로운 형식 (객체 배열) 확인
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 이전 형식 (문자열 배열)인 경우 변환
          if (typeof parsed[0] === 'string') {
            return parsed.map(color => ({ color, label: '' }));
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load colors from localStorage:', e);
    }
    return DEFAULT_COLOR_ITEMS;
  });

  // 색상이 변경될 때마다 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(colorItems));
    } catch (e) {
      console.error('Failed to save colors to localStorage:', e);
    }
  }, [colorItems]);

  const addColor = (color, label = '') => {
    if (!colorItems.find(item => item.color === color)) {
      setColorItems([...colorItems, { color, label }]);
    }
  };

  const removeColor = (color) => {
    if (colorItems.length > 1) {
      setColorItems(colorItems.filter(item => item.color !== color));
    }
  };

  const updateColorLabel = (color, label) => {
    setColorItems(colorItems.map(item =>
      item.color === color ? { ...item, label } : item
    ));
  };

  const resetColors = () => {
    setColorItems(DEFAULT_COLOR_ITEMS);
  };

  // 외부에서 색상 설정 직접 설정 (다이어그램 불러오기 시 사용)
  const loadColorItems = (items) => {
    if (Array.isArray(items) && items.length > 0) {
      setColorItems(items);
    }
  };

  // 하위 호환성을 위해 colors 배열도 제공
  const colors = colorItems.map(item => item.color);

  const value = {
    colors,
    colorItems,
    addColor,
    removeColor,
    updateColorLabel,
    resetColors,
    loadColorItems,
    defaultColorItems: DEFAULT_COLOR_ITEMS,
  };

  return (
    <ColorSettingsContext.Provider value={value}>
      {children}
    </ColorSettingsContext.Provider>
  );
};

export const useColorSettings = () => {
  const context = useContext(ColorSettingsContext);
  if (!context) {
    throw new Error('useColorSettings must be used within a ColorSettingsProvider');
  }
  return context;
};

export default ColorSettingsContext;
