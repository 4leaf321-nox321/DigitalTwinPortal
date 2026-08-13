/**
 * IndexedDB 기반 스토리지 헬퍼
 * localStorage 용량 제한(~5MB)을 해결하기 위해 IndexedDB 사용 (수백 MB 이상 가능)
 *
 * - 동기 읽기를 위한 인메모리 캐시 유지
 * - 쓰기는 캐시 + IndexedDB에 비동기로 저장
 * - 앱 시작 시 initStorage()로 IndexedDB → 캐시 로드
 */

const DB_NAME = 'digitalTwinDashboard';
const DB_VERSION = 1;
const STORE_NAME = 'keyValueStore';

// 인메모리 캐시 (동기 읽기용)
const cache = new Map();

let dbInstance = null;
let dbReady = null; // Promise that resolves when DB is ready

/**
 * IndexedDB 열기
 */
const openDB = () => {
  if (dbReady) return dbReady;

  dbReady = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.error('[storageHelper] IndexedDB 열기 실패:', event.target.error);
        reject(event.target.error);
      };
    } catch (error) {
      console.error('[storageHelper] IndexedDB 사용 불가:', error);
      reject(error);
    }
  });

  return dbReady;
};

/**
 * IndexedDB에서 값 읽기
 */
const getFromDB = async (key) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`[storageHelper] IndexedDB 읽기 실패 (${key}):`, error);
    return undefined;
  }
};

/**
 * IndexedDB에 값 쓰기
 */
const setToDB = async (key, value) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`[storageHelper] IndexedDB 쓰기 실패 (${key}):`, error);
  }
};

/**
 * IndexedDB에서 값 삭제
 */
const removeFromDB = async (key) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`[storageHelper] IndexedDB 삭제 실패 (${key}):`, error);
  }
};

// ============== Public API ==============

/**
 * 스토리지 초기화 - 앱 시작 시 호출
 * IndexedDB에서 데이터를 읽어 인메모리 캐시에 로드
 * localStorage에 기존 데이터가 있으면 IndexedDB로 마이그레이션
 */
export const initStorage = async (keys) => {
  try {
    await openDB();

    for (const key of keys) {
      // IndexedDB에서 먼저 로드 시도
      const dbValue = await getFromDB(key);

      if (dbValue !== undefined) {
        cache.set(key, dbValue);
      } else {
        // IndexedDB에 없으면 localStorage에서 마이그레이션
        try {
          const localValue = localStorage.getItem(key);
          if (localValue) {
            const parsed = JSON.parse(localValue);
            cache.set(key, parsed);
            // IndexedDB에 저장 (마이그레이션)
            await setToDB(key, parsed);
            // localStorage에서 제거 (공간 확보)
            localStorage.removeItem(key);
            console.log(`[storageHelper] localStorage → IndexedDB 마이그레이션 완료: ${key}`);
          }
        } catch (e) {
          console.warn(`[storageHelper] localStorage 마이그레이션 실패 (${key}):`, e);
        }
      }
    }

    console.log('[storageHelper] 스토리지 초기화 완료');
  } catch (error) {
    console.error('[storageHelper] 스토리지 초기화 실패:', error);
    // IndexedDB 실패 시 localStorage 폴백
    for (const key of keys) {
      try {
        const localValue = localStorage.getItem(key);
        if (localValue) {
          cache.set(key, JSON.parse(localValue));
        }
      } catch (e) {
        // ignore
      }
    }
  }
};

/**
 * 동기 읽기 - 인메모리 캐시에서 반환
 */
export const getItem = (key) => {
  return cache.get(key) ?? null;
};

/**
 * 저장 - 캐시 업데이트 + IndexedDB 비동기 쓰기
 * localStorage quota 문제 없음
 */
export const setItem = (key, value) => {
  // 캐시 즉시 업데이트 (동기)
  cache.set(key, value);

  // IndexedDB에 비동기 저장 (fire-and-forget)
  setToDB(key, value).catch(error => {
    console.error(`[storageHelper] 저장 실패 (${key}):`, error);
  });
};

/**
 * 삭제 - 캐시 + IndexedDB 모두 삭제
 */
export const removeItem = (key) => {
  cache.delete(key);
  removeFromDB(key).catch(error => {
    console.error(`[storageHelper] 삭제 실패 (${key}):`, error);
  });
};

/**
 * 전체 삭제 (지정된 키들)
 */
export const clearItems = (keys) => {
  for (const key of keys) {
    removeItem(key);
  }
};
