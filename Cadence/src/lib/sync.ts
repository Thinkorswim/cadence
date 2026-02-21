const BASE_URL = "https://api.groundedmomentum.com";

// Sync status management
export type SyncStatus = "idle" | "syncing" | "success" | "error";
type SyncStatusListener = (status: SyncStatus) => void;

let currentSyncStatus: SyncStatus = "idle";
const syncStatusListeners: Set<SyncStatusListener> = new Set();

export const getSyncStatus = (): SyncStatus => currentSyncStatus;

export const subscribeSyncStatus = (listener: SyncStatusListener): (() => void) => {
  syncStatusListeners.add(listener);
  return () => syncStatusListeners.delete(listener);
};

const setSyncStatus = (status: SyncStatus): void => {
  currentSyncStatus = status;
  syncStatusListeners.forEach((listener) => listener(status));
};

// Storage keys and their corresponding backend field names
interface SyncFieldMapping {
  localKey: string;
  backendKey: string;
  transform?: {
    toBackend: (localData: any) => any;
    toLocal: (backendData: any) => any;
  };
}

// Helper: Convert local historical stats Record<string, CompletedSession[]> to backend array format
const historicalToBackend = (
  obj: Record<string, any[]> | null
): Array<{ date: string; completedSessions: any[] }> => {
  if (!obj || Array.isArray(obj)) return [];
  return Object.entries(obj).map(([date, completedSessions]) => ({
    date,
    completedSessions: completedSessions || [],
  }));
};

// Helper: Convert backend array format to local Record<string, CompletedSession[]>
const historicalToLocal = (
  arr: Array<{ date: string; completedSessions: any[] }> | null
): Record<string, any[]> => {
  if (!arr || !Array.isArray(arr)) return {};
  const result: Record<string, any[]> = {};
  arr.forEach((item) => {
    if (item.date) {
      result[item.date] = item.completedSessions || [];
    }
  });
  return result;
};

const SYNC_FIELD_MAPPINGS: SyncFieldMapping[] = [
  { localKey: "settings", backendKey: "settings" },
  {
    localKey: "blockedWebsites",
    backendKey: "blockedWebsites",
    transform: {
      // Local BlockedWebsites class uses Set for websites, backend uses array
      toBackend: (data: any) => {
        if (!data) return { websites: [], enabled: false };
        
        // Convert Set to array or use existing array
        let websitesArray: any[] = [];
        if (data.websites instanceof Set) {
          websitesArray = Array.from(data.websites);
        } else if (Array.isArray(data.websites)) {
          websitesArray = data.websites;
        }
        
        // Filter out non-string values (empty objects, null, undefined, etc.)
        websitesArray = websitesArray.filter((item: any) => 
          typeof item === 'string' && item.trim().length > 0
        );
        
        return {
          websites: websitesArray,
          enabled: data.enabled || false,
        };
      },
      toLocal: (data: any) => {
        if (!data) return { websites: new Set<string>(), enabled: false };
        
        // Ensure data.websites is an array before filtering
        const rawWebsites = Array.isArray(data.websites) ? data.websites : [];
        
        // Filter to only include valid strings
        const websitesArray = rawWebsites.filter((item: any) => 
          typeof item === 'string' && item.trim().length > 0
        );
        
        return {
          websites: websitesArray,
          enabled: data.enabled || false,
        };
      },
    },
  },
  { localKey: "dailyStats", backendKey: "dailyStats" },
  {
    localKey: "historicalStats",
    backendKey: "historicalStats",
    transform: {
      // Backend stores array of {date, completedSessions}, local stores Record<date, completedSessions[]>
      toBackend: (data: any) => {
        // Handle both legacy {stats: ...} and new flat structure
        return historicalToBackend(data?.stats || data);
      },
      toLocal: (data: any) => {
        return historicalToLocal(data);
      },
    },
  },
];

// Fetch sync data from backend
const fetchSyncData = async (authToken: string): Promise<any | null> => {
  try {
    const response = await fetch(`${BASE_URL}/api/cadence`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 403) return null; // Not Pro
      throw new Error("Failed to fetch sync data");
    }

    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error("Error fetching sync data:", error);
    return null;
  }
};

// Push local data to backend
const pushSyncData = async (authToken: string, data: Record<string, any>): Promise<boolean> => {
  try {
    const response = await fetch(`${BASE_URL}/api/cadence`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(data),
    });
    return response.ok;
  } catch (error) {
    console.error("Error pushing sync data:", error);
    return false;
  }
};

// Get all local data for syncing
const getLocalSyncData = async (): Promise<Record<string, any>> => {
  const keys = SYNC_FIELD_MAPPINGS.map((m) => m.localKey);
  const localData = await browser.storage.local.get(keys);

  const syncData: Record<string, any> = {};

  for (const mapping of SYNC_FIELD_MAPPINGS) {
    const localValue = localData[mapping.localKey];
    if (localValue !== undefined) {
      const transformedValue = mapping.transform
        ? mapping.transform.toBackend(localValue)
        : localValue;
      syncData[mapping.backendKey] = transformedValue;
    }
  }

  return syncData;
};

// Apply backend data to local storage
const applyBackendData = async (backendData: Record<string, any>): Promise<void> => {
  const localUpdates: Record<string, any> = {};
  const today = new Date().toLocaleDateString('en-CA').slice(0, 10);

  // Read current local data upfront so we can protect it against stale backend overwrites
  const existingLocal = await browser.storage.local.get(['dailyStats']);

  for (const mapping of SYNC_FIELD_MAPPINGS) {
    const value = backendData[mapping.backendKey];
    if (value !== undefined) {
      // Special handling for dailyStats - check if the date is old
      if (mapping.localKey === 'dailyStats' && value?.date) {
        if (value.date !== today) {
          // Backend has yesterday's stats — move them to historical
          if (value.completedSessions && value.completedSessions.length > 0) {
            const localData = await browser.storage.local.get(['historicalStats']);
            let historicalStats = localData.historicalStats || {};
            
            // Handle legacy { stats: ... } wrapper if present
            if (historicalStats.stats) {
              historicalStats = historicalStats.stats;
            }
            // Ensure we have a valid object (not array from some other legacy state)
            if (Array.isArray(historicalStats)) {
              historicalStats = historicalToLocal(historicalStats);
            }
            
            historicalStats[value.date] = value.completedSessions;
            localUpdates.historicalStats = historicalStats;
            
            // Sync the historical update to backend
            await makeSyncRequest('/api/cadence/historical-stats/day', 'POST', {
              date: value.date,
              completedSessions: value.completedSessions
            }, 'Error syncing historical day');
          }
          
          // Set today's dailyStats, preserving any sessions already recorded locally today.
          // Without this check, a stale backend date would reset today's local sessions to [].
          const localHasToday = existingLocal.dailyStats?.date === today &&
                                 (existingLocal.dailyStats?.completedSessions?.length ?? 0) > 0;
          const todayStats = localHasToday
            ? existingLocal.dailyStats
            : { date: today, completedSessions: [] };

          localUpdates.dailyStats = todayStats;
          
          // Push today's stats to backend so it is no longer behind
          await makeSyncRequest('/api/cadence/daily-stats', 'PUT', todayStats, 'Error syncing updated daily stats');
          
          continue; // Skip the normal mapping logic
        } else {
          // Backend and local are both today — merge sessions from both sides so neither
          // device loses sessions it recorded before the last sync.
          const localSessions: any[] = existingLocal.dailyStats?.completedSessions ?? [];
          const backendSessions: any[] = value.completedSessions ?? [];

          const byTime = new Map<string, any>();
          for (const s of backendSessions) byTime.set(s.timeStarted, s);
          for (const s of localSessions) byTime.set(s.timeStarted, s);

          const mergedSessions = Array.from(byTime.values())
            .sort((a, b) => new Date(a.timeStarted).getTime() - new Date(b.timeStarted).getTime());

          const mergedDailyStats = { date: today, completedSessions: mergedSessions };

          // Push merged result if it differs from what the backend already has
          if (mergedSessions.length !== backendSessions.length) {
            await makeSyncRequest('/api/cadence/daily-stats', 'PUT', mergedDailyStats, 'Error syncing merged daily stats');
          }

          // Store merged result locally regardless
          localUpdates.dailyStats = mergedDailyStats;
          continue;
        }
      }
      
      localUpdates[mapping.localKey] = mapping.transform?.toLocal
        ? mapping.transform.toLocal(value)
        : value;
    }
  }

  // Merge daily stats into historical stats for local storage (so history view is up to date)
  if (localUpdates.dailyStats && localUpdates.historicalStats) {
    // Ensure historicalStats is not null/undefined before assignment
    localUpdates.historicalStats[localUpdates.dailyStats.date] = localUpdates.dailyStats.completedSessions || [];
  }

  await browser.storage.local.set(localUpdates);
};

// Helper to get auth token and check if user is Pro
const getAuthTokenAndCheckPro = async (): Promise<string | null> => {
  try {
    const data = await browser.storage.local.get(["user"]);
    if (data.user?.isPro && data.user?.authToken) {
      return data.user.authToken;
    }
    return null;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

// Helper function to make sync API calls
const makeSyncRequest = async (
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: any,
  errorContext?: string
): Promise<void> => {
  const authToken = await getAuthTokenAndCheckPro();
  if (!authToken) return;

  setSyncStatus("syncing");

  try {
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);

    if (response.ok) {
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } else {
      setSyncStatus("error");
    }
  } catch (error) {
    console.error(errorContext || "Error syncing data:", error);
    setSyncStatus("error");
  }
};

// Main sync function - syncs all data with backend
// Always uses backend data if it exists, otherwise pushes local data
export const syncAll = async (authToken: string): Promise<void> => {
  setSyncStatus("syncing");

  try {
    const backendData = await fetchSyncData(authToken);

    if (backendData === null) {
      // No backend data - push local data
      const localData = await getLocalSyncData();
      const success = await pushSyncData(authToken, localData);
      if (success) {
        setSyncStatus("success");
      } else {
        setSyncStatus("error");
      }
    } else {
      // Backend has data - apply it locally
      await applyBackendData(backendData);
      setSyncStatus("success");
    }
  } catch (error) {
    console.error("Sync error:", error);
    setSyncStatus("error");
  }
};

// Sync when updating settings (includes projects)
export const syncUpdateSettings = async (settingsData: any): Promise<void> => {
  await makeSyncRequest("/api/cadence/settings", "PUT", settingsData, "Error syncing settings update");
};

// Sync when toggling blocked websites enabled/disabled
export const syncToggleBlockedWebsites = async (enabled: boolean): Promise<void> => {
  await makeSyncRequest("/api/cadence/blocked-websites/toggle", "PUT", { enabled }, "Error syncing blocked websites toggle");
};

// Sync when adding a blocked website
export const syncAddBlockedWebsite = async (website: string): Promise<void> => {
  await makeSyncRequest("/api/cadence/blocked-website", "POST", { website }, "Error syncing new blocked website");
};

// Sync when deleting a blocked website
export const syncDeleteBlockedWebsite = async (website: string): Promise<void> => {
  await makeSyncRequest("/api/cadence/blocked-website", "DELETE", { website }, "Error syncing blocked website deletion");
};

// Sync when updating daily stats
export const syncUpdateDailyStats = async (dailyStats: { date: string; completedSessions: any[] }): Promise<void> => {
  await makeSyncRequest("/api/cadence/daily-stats", "PUT", dailyStats, "Error syncing daily stats");
};

// Sync when adding a single day's stats to historical (incremental)
export const syncAddHistoricalDay = async (date: string, completedSessions: any[]): Promise<void> => {
  await makeSyncRequest("/api/cadence/historical-stats/day", "POST", { date, completedSessions }, "Error syncing historical day");
};

// Fetch historical stats from backend (only when needed)
export const fetchHistoricalStats = async (): Promise<Record<string, any[]> | null> => {
  const authToken = await getAuthTokenAndCheckPro();
  if (!authToken) return null;

  try {
    const response = await fetch(`${BASE_URL}/api/cadence/historical-stats`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 403) return null; // Not Pro
      throw new Error("Failed to fetch historical stats");
    }

    const result = await response.json();
    if (result.success && result.data) {
      return historicalToLocal(result.data);
    }
    return null;
  } catch (error) {
    console.error("Error fetching historical stats:", error);
    return null;
  }
};

