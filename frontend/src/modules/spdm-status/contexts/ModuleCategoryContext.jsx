import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { spdmApi } from '../services/spdmApi';

const DEFAULT_CATEGORIES = [];

const DEFAULT_SYSTEMS = [];

const DEFAULT_LINK_METHODS = [];

const ModuleCategoryContext = createContext(null);

let _idCounter = 0;
const generateId = (prefix) => `${prefix}-${Date.now()}-${++_idCounter}`;

export const ModuleCategoryProvider = ({ children }) => {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [systems, setSystems] = useState(DEFAULT_SYSTEMS);
  const [linkMethods, setLinkMethods] = useState(DEFAULT_LINK_METHODS);
  const [systemDescriptions, setSystemDescriptions] = useState({});
  const [groups, setGroups] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState({});
  const [categoryDetails, setCategoryDetails] = useState({});
  const [divisionScores, setDivisionScores] = useState({}); // { [detailId]: { [division]: score } }
  const [divisionModules, setDivisionModules] = useState({}); // { [detailId]: { [division]: [moduleId, ...] } }
  const [divisionComments, setDivisionComments] = useState({}); // { [detailId]: { [division]: string } }
  const [loading, setLoading] = useState(true);

  // Refs to track latest state for async save operations
  const categoriesRef = useRef(categories);
  const systemsRef = useRef(systems);
  const linkMethodsRef = useRef(linkMethods);

  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { systemsRef.current = systems; }, [systems]);
  useEffect(() => { linkMethodsRef.current = linkMethods; }, [linkMethods]);

  // Load settings from DB on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await spdmApi.getModuleSettings();
        if (cancelled) return;
        if (Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
        if (Array.isArray(data.systems)) {
          setSystems(data.systems);
        }
        if (Array.isArray(data.linkMethods)) {
          setLinkMethods(data.linkMethods);
        }
        if (data.systemDescriptions && typeof data.systemDescriptions === 'object') {
          setSystemDescriptions(data.systemDescriptions);
        }
        if (Array.isArray(data.groups)) {
          setGroups(data.groups);
        }
        if (data.categoryGroups && typeof data.categoryGroups === 'object') {
          setCategoryGroups(data.categoryGroups);
        }
        if (data.categoryDetails && typeof data.categoryDetails === 'object') {
          setCategoryDetails(data.categoryDetails);
        }
        if (data.divisionScores && typeof data.divisionScores === 'object') {
          setDivisionScores(data.divisionScores);
        }
        if (data.divisionModules && typeof data.divisionModules === 'object') {
          setDivisionModules(data.divisionModules);
        }
        if (data.divisionComments && typeof data.divisionComments === 'object') {
          setDivisionComments(data.divisionComments);
        }
      } catch (e) {
        console.error('Failed to load module settings from DB:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Persist helper — fire-and-forget save to DB
  const persistToDb = useCallback((patch) => {
    spdmApi.updateModuleSettings(patch).catch(e => {
      console.error('Failed to save module settings to DB:', e);
    });
  }, []);

  // ===== Category CRUD =====
  const addCategory = (label) => {
    const trimmed = label.trim();
    if (trimmed && !categories.includes(trimmed)) {
      const next = [...categories, trimmed];
      setCategories(next);
      persistToDb({ categories: next });
    }
  };

  const removeCategory = (label) => {
    if (categories.length > 1) {
      const next = categories.filter(c => c !== label);
      setCategories(next);

      // Cascade: remove from categoryGroups and categoryDetails
      setCategoryGroups(prev => {
        const updated = { ...prev };
        delete updated[label];
        persistToDb({ categories: next, categoryGroups: updated, categoryDetails: (() => {
          const d = { ...categoryDetails };
          delete d[label];
          return d;
        })() });
        return updated;
      });
      setCategoryDetails(prev => {
        const updated = { ...prev };
        delete updated[label];
        return updated;
      });
    }
  };

  const updateCategory = (oldLabel, newLabel) => {
    const trimmed = newLabel.trim();
    if (trimmed && !categories.includes(trimmed)) {
      const next = categories.map(c => c === oldLabel ? trimmed : c);
      setCategories(next);

      // Cascade: rename key in categoryGroups and categoryDetails
      const nextCG = { ...categoryGroups };
      if (oldLabel in nextCG) {
        nextCG[trimmed] = nextCG[oldLabel];
        delete nextCG[oldLabel];
      }
      setCategoryGroups(nextCG);

      const nextCD = { ...categoryDetails };
      if (oldLabel in nextCD) {
        nextCD[trimmed] = nextCD[oldLabel];
        delete nextCD[oldLabel];
      }
      setCategoryDetails(nextCD);

      persistToDb({ categories: next, categoryGroups: nextCG, categoryDetails: nextCD });
    }
  };

  const resetCategories = () => {
    setCategories(DEFAULT_CATEGORIES);
    setCategoryGroups({});
    setCategoryDetails({});
    persistToDb({ categories: DEFAULT_CATEGORIES, categoryGroups: {}, categoryDetails: {} });
  };

  // ===== System CRUD =====
  const addSystem = (label) => {
    const trimmed = label.trim();
    if (trimmed && !systems.includes(trimmed)) {
      const next = [...systems, trimmed];
      setSystems(next);
      persistToDb({ systems: next });
    }
  };

  const removeSystem = (label) => {
    if (systems.length > 1) {
      const next = systems.filter(s => s !== label);
      setSystems(next);
      const nextDesc = { ...systemDescriptions };
      delete nextDesc[label];
      setSystemDescriptions(nextDesc);
      persistToDb({ systems: next, systemDescriptions: nextDesc });
    }
  };

  const updateSystem = (oldLabel, newLabel) => {
    const trimmed = newLabel.trim();
    if (trimmed && !systems.includes(trimmed)) {
      const next = systems.map(s => s === oldLabel ? trimmed : s);
      setSystems(next);
      const nextDesc = { ...systemDescriptions };
      if (oldLabel in nextDesc) {
        nextDesc[trimmed] = nextDesc[oldLabel];
        delete nextDesc[oldLabel];
      }
      setSystemDescriptions(nextDesc);
      persistToDb({ systems: next, systemDescriptions: nextDesc });
    }
  };

  const updateSystemDescription = (systemName, description) => {
    const next = { ...systemDescriptions, [systemName]: description };
    setSystemDescriptions(next);
    persistToDb({ systemDescriptions: next });
  };

  const resetSystems = () => {
    setSystems(DEFAULT_SYSTEMS);
    setSystemDescriptions({});
    persistToDb({ systems: DEFAULT_SYSTEMS, systemDescriptions: {} });
  };

  // ===== LinkMethod CRUD =====
  const linkMethodLabels = linkMethods.map(m => m.label);

  const addLinkMethod = (label, type = 'non-system') => {
    const trimmed = label.trim();
    if (trimmed && !linkMethodLabels.includes(trimmed)) {
      const next = [...linkMethods, { label: trimmed, type }];
      setLinkMethods(next);
      persistToDb({ linkMethods: next });
    }
  };

  const removeLinkMethod = (label) => {
    if (linkMethods.length > 1) {
      const next = linkMethods.filter(m => m.label !== label);
      setLinkMethods(next);
      persistToDb({ linkMethods: next });
    }
  };

  const updateLinkMethod = (oldLabel, newLabel) => {
    const trimmed = newLabel.trim();
    if (trimmed && !linkMethodLabels.includes(trimmed)) {
      const next = linkMethods.map(m => m.label === oldLabel ? { ...m, label: trimmed } : m);
      setLinkMethods(next);
      persistToDb({ linkMethods: next });
    }
  };

  const updateLinkMethodType = (label, type) => {
    const next = linkMethods.map(m => m.label === label ? { ...m, type } : m);
    setLinkMethods(next);
    persistToDb({ linkMethods: next });
  };

  const resetLinkMethods = () => {
    setLinkMethods(DEFAULT_LINK_METHODS);
    persistToDb({ linkMethods: DEFAULT_LINK_METHODS });
  };

  const getLinkMethodType = (label) => {
    const found = linkMethods.find(m => m.label === label);
    return found ? found.type : 'non-system';
  };

  // ===== Group CRUD =====
  const addGroup = (name) => {
    const trimmed = name.trim();
    if (trimmed && !groups.some(g => g.name === trimmed)) {
      const next = [...groups, { id: generateId('grp'), name: trimmed }];
      setGroups(next);
      persistToDb({ groups: next });
    }
  };

  const removeGroup = (id) => {
    const next = groups.filter(g => g.id !== id);
    setGroups(next);

    // Cascade: remove this group id from all categoryGroups
    const nextCG = {};
    for (const [cat, ids] of Object.entries(categoryGroups)) {
      nextCG[cat] = ids.filter(gid => gid !== id);
    }
    setCategoryGroups(nextCG);

    persistToDb({ groups: next, categoryGroups: nextCG });
  };

  const updateGroup = (id, newName) => {
    const trimmed = newName.trim();
    if (trimmed && !groups.some(g => g.name === trimmed && g.id !== id)) {
      const next = groups.map(g => g.id === id ? { ...g, name: trimmed } : g);
      setGroups(next);
      persistToDb({ groups: next });
    }
  };

  const resetGroups = () => {
    setGroups([]);
    setCategoryGroups({});
    persistToDb({ groups: [], categoryGroups: {} });
  };

  // ===== Category-Group Connection =====
  const toggleCategoryGroup = (categoryName, groupId) => {
    const current = categoryGroups[categoryName] || [];
    const next = current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId];
    const nextCG = { ...categoryGroups, [categoryName]: next };
    setCategoryGroups(nextCG);
    persistToDb({ categoryGroups: nextCG });
  };

  // ===== Detail Item CRUD =====
  const addDetailItem = (categoryName, name, type = 'score') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const items = categoryDetails[categoryName] || [];
    const newItem = { id: generateId('det'), name: trimmed, type, criteria: [] };
    const nextItems = [...items, newItem];
    const nextCD = { ...categoryDetails, [categoryName]: nextItems };
    setCategoryDetails(nextCD);
    persistToDb({ categoryDetails: nextCD });
  };

  const removeDetailItem = (categoryName, detailId) => {
    const items = categoryDetails[categoryName] || [];
    const nextItems = items.filter(d => d.id !== detailId);
    const nextCD = { ...categoryDetails, [categoryName]: nextItems };
    setCategoryDetails(nextCD);
    persistToDb({ categoryDetails: nextCD });
  };

  const updateDetailItem = (categoryName, detailId, updates) => {
    const items = categoryDetails[categoryName] || [];
    const nextItems = items.map(d => d.id === detailId ? { ...d, ...updates } : d);
    const nextCD = { ...categoryDetails, [categoryName]: nextItems };
    setCategoryDetails(nextCD);
    persistToDb({ categoryDetails: nextCD });
  };

  const updateDetailCriteria = (categoryName, detailId, criteria) => {
    updateDetailItem(categoryName, detailId, { criteria });
  };

  // ===== Division Scores =====
  const updateDivisionScore = (detailId, division, score) => {
    const next = {
      ...divisionScores,
      [detailId]: { ...(divisionScores[detailId] || {}), [division]: score },
    };
    setDivisionScores(next);
    persistToDb({ divisionScores: next });
  };

  // ===== Division Modules =====
  const updateDivisionModules = (detailId, division, moduleIds) => {
    const next = {
      ...divisionModules,
      [detailId]: { ...(divisionModules[detailId] || {}), [division]: moduleIds },
    };
    setDivisionModules(next);
    persistToDb({ divisionModules: next });
  };

  // ===== Division Comments =====
  const updateDivisionComment = (detailId, division, comment) => {
    const next = {
      ...divisionComments,
      [detailId]: { ...(divisionComments[detailId] || {}), [division]: comment },
    };
    setDivisionComments(next);
    persistToDb({ divisionComments: next });
  };

  const value = {
    categories,
    addCategory,
    removeCategory,
    updateCategory,
    resetCategories,
    defaultCategories: DEFAULT_CATEGORIES,
    systems,
    systemDescriptions,
    addSystem,
    removeSystem,
    updateSystem,
    updateSystemDescription,
    resetSystems,
    defaultSystems: DEFAULT_SYSTEMS,
    linkMethods,
    linkMethodLabels,
    addLinkMethod,
    removeLinkMethod,
    updateLinkMethod,
    updateLinkMethodType,
    resetLinkMethods,
    getLinkMethodType,
    defaultLinkMethods: DEFAULT_LINK_METHODS,
    // Groups
    groups,
    addGroup,
    removeGroup,
    updateGroup,
    resetGroups,
    // Category-Group connection
    categoryGroups,
    toggleCategoryGroup,
    // Detail items + criteria
    categoryDetails,
    addDetailItem,
    removeDetailItem,
    updateDetailItem,
    updateDetailCriteria,
    // Division scores & modules
    divisionScores,
    updateDivisionScore,
    divisionModules,
    updateDivisionModules,
    divisionComments,
    updateDivisionComment,
    loading,
  };

  return (
    <ModuleCategoryContext.Provider value={value}>
      {children}
    </ModuleCategoryContext.Provider>
  );
};

export const useModuleCategories = () => {
  const context = useContext(ModuleCategoryContext);
  if (!context) {
    throw new Error('useModuleCategories must be used within a ModuleCategoryProvider');
  }
  return context;
};

export default ModuleCategoryContext;
