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
        return {
          websites: data.websites instanceof Set ? Array.from(data.websites) : (data.websites || []),
          enabled: data.enabled || false,
        };
      },
      toLocal: (data: any) => {
        if (!data) return { websites: new Set<string>(), enabled: false };
        return {
          websites: new Set(data.websites || []),
          enabled: data.enabled || false,
        };
      },
    },
  },
  { localKey: "dailyStats", backendKey: "dailyStats" },
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

  for (const mapping of SYNC_FIELD_MAPPINGS) {
    const value = backendData[mapping.backendKey];
    if (value !== undefined) {
      localUpdates[mapping.localKey] = mapping.transform?.toLocal
        ? mapping.transform.toLocal(value)
        : value;
    }
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
        setTimeout(() => setSyncStatus("idle"), 2000);
      } else {
        setSyncStatus("error");
      }
    } else {
      // Backend has data - apply it locally
      await applyBackendData(backendData);
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);
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

// Push all local data to backend (used on day reset or manual sync)
export const syncPushAll = async (): Promise<void> => {
  const authToken = await getAuthTokenAndCheckPro();
  if (!authToken) return;

  try {
    const localData = await getLocalSyncData();
    await pushSyncData(authToken, localData);
  } catch (error) {
    console.error("Error pushing all data:", error);
  }
};
