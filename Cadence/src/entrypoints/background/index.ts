import { TimerState } from "@/models/TimerState";
import { SessionStatus } from "@/models/SessionStatus";
import { ChartType } from "@/models/ChartType";
import { BadgeDisplayFormat } from "@/models/BadgeDisplayFormat";
import { timeDisplayFormatBadge } from "@/lib/utils";
import { DailyStats } from "@/models/DailyStats";
import { CompletedSession } from "@/models/CompletedSession";
import { HistoricalStats } from "@/models/HistoricalStats";
import { Session } from "@/models/Session";
import { Settings } from "@/models/Settings";
import { BlockedWebsites } from "@/models/BlockedWebsites";
import { extractHostnameAndDomain, isUrlBlocked } from "@/lib/utils";
import { syncAddHistoricalDay, syncUpdateDailyStats } from "@/lib/sync";

import { getWebSocketClient, resetWebSocketClient } from '@/lib/websockets';

export default defineBackground(() => {
    // Offscreen document management
    let offscreenDocumentCreated = false;
    
    // WebSocket client instance
    let wsClient: ReturnType<typeof getWebSocketClient> | null = null;
    
    // Cache settings that are used frequently
    let cachedBadgeDisplayFormat: BadgeDisplayFormat = BadgeDisplayFormat.Minutes;

    // Function to update cached settings
    const updateCachedSettings = (settings: Settings) => {
        cachedBadgeDisplayFormat = settings.badgeDisplayFormat;
    };

    const createOffscreenDocument = async () => {
        if (offscreenDocumentCreated) return;
        
        try {
            if (!browser.offscreen) {
                return;
            }
            
            await browser.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Playing notification sounds for timer completion.'
            });
            offscreenDocumentCreated = true;
        } catch (error) {
            console.error('Error creating offscreen document:', error);
        }
    };

    const playNotificationSound = async (settings: Settings) => {
        try {
            if (settings.soundEnabled) {
                const soundFile = `/sounds/${settings.selectedSound}`;
                // Check if we're in Firefox or if offscreen API is not available
                if (import.meta.env.BROWSER === 'firefox' || !browser.offscreen) {
                    try {
                        const audio = new Audio(browser.runtime.getURL(soundFile as any));
                        audio.volume = Math.max(0, Math.min(1, settings.soundVolume));
                        await audio.play();
                    } catch (error) {
                        console.warn('Direct audio playback failed, this is expected in some browsers:', error);
                    }
                } else {
                    // Chrome/Edge: Use offscreen document
                    await createOffscreenDocument();
                    browser.runtime.sendMessage({
                        action: 'playSound',
                        soundFile: soundFile,
                        volume: settings.soundVolume
                    });
                }
            }
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    };

    // Initialize WebSocket connection for Pro users
    const initializeWebSocket = async (authToken: string) => {
        try {
            if (wsClient) {
                return;
            }
            
            wsClient = getWebSocketClient();
            const authResponse = await wsClient.connect(authToken);
            
            // Use session from auth response (no need for extra request)
            if (authResponse.session) {
                const sessionData = authResponse.session;
                const remoteSession = Session.fromJSON({
                    accumulatedTime: sessionData.accumulatedTime,
                    timerState: sessionData.timerState === 'focus' ? TimerState.Focus : 
                               sessionData.timerState === 'short_break' ? TimerState.ShortBreak : TimerState.LongBreak,
                    status: sessionData.status === 'running' ? SessionStatus.Running : 
                           sessionData.status === 'paused' ? SessionStatus.Paused : SessionStatus.Stopped,
                    createdAt: sessionData.createdAt,
                    currentRunStartedAt: sessionData.currentRunStartedAt,
                    project: sessionData.project,
                    focusDuration: sessionData.focusDuration,
                    shortBreakDuration: sessionData.shortBreakDuration,
                    longBreakDuration: sessionData.longBreakDuration
                });
                
                // Sync timer state with remote session
                if (remoteSession.status === SessionStatus.Running) {
                    if (!timer) {
                        timer = setInterval(() => updateTime(), 1000);
                    }
                } else {
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                }
                
                browser.storage.local.set({ session: remoteSession.toJSON() });
                browser.runtime.sendMessage({ action: "updateSession", session: remoteSession });
            }
            
            // Listen for session updates from other devices
            wsClient.onSessionUpdate((sessionData) => {
                
                if (sessionData === null) {
                    // Session was stopped on another device
                    browser.storage.local.get(["session"], (data) => {
                        if (data.session) {
                            const session = Session.fromJSON(data.session);
                            session.status = SessionStatus.Stopped;
                            session.accumulatedTime = 0;
                            session.currentRunStartedAt = null;
                            session.timerState = TimerState.Focus;
                            
                            // Clear timer if running
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            
                            setBadge("", "red");
                            browser.storage.local.set({ session: session.toJSON() });
                            browser.runtime.sendMessage({ action: "updateSession", session });
                        }
                    });
                } else {
                    // Get current local session to check if we need to preserve local timing
                    browser.storage.local.get(["session"], (localData) => {
                        const localSession = localData.session ? Session.fromJSON(localData.session) : null;
                        const isLocallyRunning = localSession?.status === SessionStatus.Running;
                        const incomingTimerState = sessionData.timerState === 'focus' ? TimerState.Focus : 
                                                   sessionData.timerState === 'short_break' ? TimerState.ShortBreak : TimerState.LongBreak;
                        
                        // Preserve local currentRunStartedAt if session is already running locally with SAME timer state
                        // Otherwise, use local "now" to avoid clock skew with server
                        let currentRunStartedAt = sessionData.currentRunStartedAt;
                        if (sessionData.status === 'running') {
                            if (isLocallyRunning && localSession.timerState === incomingTimerState) {
                                // Same timer state running - keep local time to avoid clock skew
                                currentRunStartedAt = localSession.currentRunStartedAt?.toISOString() ?? null;
                            } else {
                                // Timer state changed or wasn't running - use local time "now"
                                currentRunStartedAt = new Date().toISOString();
                            }
                        }
                        
                        const remoteSession = Session.fromJSON({
                            accumulatedTime: sessionData.accumulatedTime,
                            timerState: incomingTimerState,
                            status: sessionData.status === 'running' ? SessionStatus.Running : 
                                   sessionData.status === 'paused' ? SessionStatus.Paused : SessionStatus.Stopped,
                            createdAt: sessionData.createdAt,
                            currentRunStartedAt: currentRunStartedAt,
                            project: sessionData.project,
                            focusDuration: sessionData.focusDuration,
                            shortBreakDuration: sessionData.shortBreakDuration,
                            longBreakDuration: sessionData.longBreakDuration
                        });
                        
                        // Sync timer state with remote session
                        if (remoteSession.status === SessionStatus.Running) {
                            // Start timer if not already running
                            if (!timer) {
                                timer = setInterval(() => updateTime(), 1000);
                            }
                            // Immediately update badge with current state
                            const now = new Date();
                            const remainingTime = remoteSession.getRemainingTime(now);
                            const badgeColor = remoteSession.timerState === TimerState.Focus ? "red" : "green";
                            setBadge(timeDisplayFormatBadge(remainingTime, cachedBadgeDisplayFormat), badgeColor);
                        } else {
                            // Stop timer if running
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            
                            // Update badge based on state
                            if (remoteSession.status === SessionStatus.Stopped) {
                                const badgeColor = remoteSession.timerState === TimerState.Focus ? "red" : "green";
                                setBadge("", badgeColor);
                            } else if (remoteSession.status === SessionStatus.Paused) {
                                // Show remaining time for paused sessions
                                const now = new Date();
                                const remainingTime = remoteSession.getRemainingTime(now);
                                const badgeColor = remoteSession.timerState === TimerState.Focus ? "red" : "green";
                                setBadge(timeDisplayFormatBadge(remainingTime, cachedBadgeDisplayFormat), badgeColor);
                            }
                        }
                        
                        browser.storage.local.set({ session: remoteSession.toJSON() });
                        browser.runtime.sendMessage({ action: "updateSession", session: remoteSession });
                    });
                }
            });
            
            // Listen for acknowledgment of our own actions
            wsClient.on('cadence:session:ack', (response) => {
                
                if (response.success && response.data) {
                    const sessionData = response.data;
                    const remoteSession = Session.fromJSON({
                        accumulatedTime: sessionData.accumulatedTime,
                        timerState: sessionData.timerState === 'focus' ? TimerState.Focus : 
                                   sessionData.timerState === 'short_break' ? TimerState.ShortBreak : TimerState.LongBreak,
                        status: sessionData.status === 'running' ? SessionStatus.Running : 
                               sessionData.status === 'paused' ? SessionStatus.Paused : SessionStatus.Stopped,
                        createdAt: sessionData.createdAt,
                        currentRunStartedAt: sessionData.currentRunStartedAt,
                        project: sessionData.project,
                        focusDuration: sessionData.focusDuration,
                        shortBreakDuration: sessionData.shortBreakDuration,
                        longBreakDuration: sessionData.longBreakDuration
                    });
                    
                    // Note: We don't manage timer here as the action already started/stopped the timer locally
                    // This acknowledgment just confirms the server received our action
                    browser.storage.local.set({ session: remoteSession.toJSON() });
                    browser.runtime.sendMessage({ action: "updateSession", session: remoteSession });
                }
            });
            
            // Listen for session response (initial sync)
            wsClient.on('cadence:session:response', (response) => {
                
                if (response.data) {
                    const sessionData = response.data;
                    const remoteSession = Session.fromJSON({
                        accumulatedTime: sessionData.accumulatedTime,
                        timerState: sessionData.timerState === 'focus' ? TimerState.Focus : 
                                   sessionData.timerState === 'short_break' ? TimerState.ShortBreak : TimerState.LongBreak,
                        status: sessionData.status === 'running' ? SessionStatus.Running : 
                               sessionData.status === 'paused' ? SessionStatus.Paused : SessionStatus.Stopped,
                        createdAt: sessionData.createdAt,
                        currentRunStartedAt: sessionData.currentRunStartedAt,
                        project: sessionData.project,
                        focusDuration: sessionData.focusDuration,
                        shortBreakDuration: sessionData.shortBreakDuration,
                        longBreakDuration: sessionData.longBreakDuration
                    });
                    
                    // Sync timer state with remote session
                    if (remoteSession.status === SessionStatus.Running) {
                        if (!timer) {
                            timer = setInterval(() => updateTime(), 1000);
                        }
                        // Immediately update badge with current state
                        const now = new Date();
                        const remainingTime = remoteSession.getRemainingTime(now);
                        const badgeColor = remoteSession.timerState === TimerState.Focus ? "red" : "green";
                        setBadge(timeDisplayFormatBadge(remainingTime, cachedBadgeDisplayFormat), badgeColor);
                    } else {
                        if (timer) {
                            clearInterval(timer);
                            timer = null;
                        }
                        // Update badge for paused/stopped sessions
                        if (remoteSession.status === SessionStatus.Stopped) {
                            const badgeColor = remoteSession.timerState === TimerState.Focus ? "red" : "green";
                            setBadge("", badgeColor);
                        } else if (remoteSession.status === SessionStatus.Paused) {
                            const now = new Date();
                            const remainingTime = remoteSession.getRemainingTime(now);
                            const badgeColor = remoteSession.timerState === TimerState.Focus ? "red" : "green";
                            setBadge(timeDisplayFormatBadge(remainingTime, cachedBadgeDisplayFormat), badgeColor);
                        }
                    }
                    
                    browser.storage.local.set({ session: remoteSession.toJSON() });
                    browser.runtime.sendMessage({ action: "updateSession", session: remoteSession });
                } else {
                    // No session on server, ensure local is clean
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                }
            });
            
            // Listen for session completion from other devices
            wsClient.onSessionCompleted((data) => {
                // The session update will handle the state change
            });
            
            // Listen for errors
            wsClient.onSessionError((error) => {
                console.error('WebSocket session error:', error);
            });
            
            // Listen for disconnections
            wsClient.onDisconnect((data) => {
                // Connection closed
            });
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            wsClient = null;
        }
    };
    
    // Check and connect WebSocket on startup (runs immediately when background script loads)
    browser.storage.local.get(["user"], (data) => {
        if (data.user?.isPro && data.user?.authToken) {
            initializeWebSocket(data.user.authToken);
        }
    });
    
    // Keep-alive for MV3 service workers - ensure WebSocket reconnects when service worker wakes
    // This runs whenever the service worker becomes active after being idle
    if (import.meta.env.BROWSER !== 'firefox') {
        // For Chrome/Edge (MV3), periodically check and reconnect if needed
        setInterval(() => {
            // Check connection status first (synchronous) to avoid unnecessary storage reads
            if (!wsClient || !wsClient.isConnected()) {
                browser.storage.local.get(["user"], (data) => {
                    if (data.user?.isPro && data.user?.authToken) {
                        if (wsClient) {
                            resetWebSocketClient();
                            wsClient = null;
                        }
                        initializeWebSocket(data.user.authToken);
                    }
                });
            }
        }, 60000); // Check every 60 seconds
    }
    
    // Listen for user changes to connect/disconnect WebSocket
    browser.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.user) {
            const newUser = changes.user.newValue;
            const oldUser = changes.user.oldValue;
            
            if (newUser?.isPro && newUser?.authToken) {
                // User became Pro or logged in
                if (!wsClient || !oldUser?.authToken || oldUser.authToken !== newUser.authToken) {
                    if (wsClient) {
                        resetWebSocketClient();
                        wsClient = null;
                    }
                    initializeWebSocket(newUser.authToken);
                }
            } else if (!newUser?.isPro || !newUser?.authToken) {
                // User logged out or is not Pro
                if (wsClient) {
                    resetWebSocketClient();
                    wsClient = null;
                }
            }
        }
    });

    browser.runtime.onInstalled.addListener((object) => {
        if (object.reason === 'install') {
            browser.runtime.openOptionsPage();
        }
        
        // Check and handle date rollover on extension load
        checkAndHandleDateRollover();

        browser.storage.local.get(["settings", "session", "dailyStats", "historicalStats", "blockedWebsites", "user"], (data) => {
            // Initialize WebSocket for Pro users after storage is set up
            if (data.user?.isPro && data.user?.authToken) {
                setTimeout(() => initializeWebSocket(data.user.authToken), 1000);
            }
            if (!data.settings) {
                const defaultSettings: Settings = Settings.fromJSON({
                    focusTime: 25 * 60, // Default to 25 minutes in seconds
                    shortBreakTime: 5 * 60, // Default to 5 minutes in seconds
                    longBreakTime: 15 * 60, // Default to 15 minutes in seconds
                    longBreakInterval: 4, // Default to every 4 cycles
                    longBreakEnabled: false, // Default to long breaks disabled
                    breakAutoStart: true, // Default to auto-start breaks
                    focusAutoStart: false, // Default to not auto-start focus
                    notificationsEnabled: true, // Default to notifications enabled
                    soundEnabled: true, // Default to sound enabled
                    soundVolume: 0.7, // Default to 70% volume
                    selectedSound: 'relaxing.ogg', // Default to relaxing.ogg
                    dailySessionsGoal: 10, // Default to 10 sessions per day
                    badgeDisplayFormat: BadgeDisplayFormat.Minutes, // Default to minutes format
                    projects: ['General'], // Default to General project
                    selectedProject: 'General' // Default to General project
                });

                browser.storage.local.set({ settings: defaultSettings.toJSON() });
                cachedBadgeDisplayFormat = defaultSettings.badgeDisplayFormat;
            } else {
                // Backward compatibility
                let needsUpdate = false;
                const updatedSettings: Settings = Settings.fromJSON(data.settings);
                
                if (data.settings.dailySessionsGoal === undefined) {
                    updatedSettings.dailySessionsGoal = 10;
                    needsUpdate = true;
                }
                
                if (data.settings.preferredChartType === undefined) {
                    updatedSettings.preferredChartType = ChartType.Sessions;
                    needsUpdate = true;
                }
                
                if (data.settings.projects === undefined) {
                    updatedSettings.projects = ['General'];
                    needsUpdate = true;
                }

                if (data.settings.selectedProject === undefined) {
                    updatedSettings.selectedProject = 'General';
                    needsUpdate = true;
                }

                if (data.settings.notificationsEnabled === undefined) {
                    updatedSettings.notificationsEnabled = true;
                    needsUpdate = true;
                }

                if (data.settings.soundEnabled === undefined) {
                    updatedSettings.soundEnabled = true;
                    needsUpdate = true;
                }

                if (data.settings.soundVolume === undefined) {
                    updatedSettings.soundVolume = 0.7;
                    needsUpdate = true;
                }

                if (data.settings.badgeDisplayFormat === undefined) {
                    updatedSettings.badgeDisplayFormat = BadgeDisplayFormat.Minutes;
                    needsUpdate = true;
                }

                if (data.settings.selectedSound === undefined) {
                    updatedSettings.selectedSound = 'relaxing.ogg';
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    browser.storage.local.set({ settings: updatedSettings.toJSON() });
                }
                
                cachedBadgeDisplayFormat = updatedSettings.badgeDisplayFormat;
            }


            if (!data.dailyStats) {
                const defaultDailyStats: DailyStats = DailyStats.fromJSON({
                    date: new Date().toLocaleDateString('en-CA').slice(0, 10),
                    completedSessions: []
                });

                browser.storage.local.set({ dailyStats: defaultDailyStats.toJSON() });
            }

            if (!data.historicalStats) {
                browser.storage.local.set({ historicalStats: new HistoricalStats().toJSON() });
            }

            // Migrate old session format or create new session
            if (!data.session || data.session.accumulatedTime === undefined) {
                // Create new session
                const settings = data.settings ? Settings.fromJSON(data.settings) : null;
                const defaultSession: Session = Session.fromJSON({
                    accumulatedTime: 0,
                    timerState: TimerState.Focus,
                    status: SessionStatus.Stopped,
                    createdAt: new Date().toISOString(),
                    currentRunStartedAt: null,
                    project: settings ? settings.selectedProject : "General",
                    focusDuration: settings ? settings.focusTime : 25 * 60,
                    shortBreakDuration: settings ? settings.shortBreakTime : 5 * 60,
                    longBreakDuration: settings ? settings.longBreakTime : 15 * 60
                });

                browser.storage.local.set({ session: defaultSession.toJSON() });
            } else if (data.session.totalTime !== undefined && data.session.focusDuration === undefined) {
                // Migrate from old format (has totalTime) to new format (has duration properties)
                const settings = data.settings ? Settings.fromJSON(data.settings) : null;
                const oldSession = data.session;
                const migratedSession: Session = Session.fromJSON({
                    accumulatedTime: oldSession.accumulatedTime || 0,
                    timerState: oldSession.timerState || TimerState.Focus,
                    status: oldSession.status || SessionStatus.Stopped,
                    createdAt: oldSession.createdAt || new Date().toISOString(),
                    currentRunStartedAt: oldSession.currentRunStartedAt || null,
                    project: oldSession.project || "General",
                    focusDuration: settings ? settings.focusTime : 25 * 60,
                    shortBreakDuration: settings ? settings.shortBreakTime : 5 * 60,
                    longBreakDuration: settings ? settings.longBreakTime : 15 * 60
                });

                browser.storage.local.set({ session: migratedSession.toJSON() });
            }

            if (!data.blockedWebsites) {
                const defaultBlockedWebsites = new BlockedWebsites();
                browser.storage.local.set({ blockedWebsites: defaultBlockedWebsites.toJSON() });
            }
        });
    });

    // Listen for storage changes to update cached settings
    browser.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.settings) {
            const newSettings = Settings.fromJSON(changes.settings.newValue);
            updateCachedSettings(newSettings);
        }
    });

    let timer: NodeJS.Timeout | null = null;

    // Helper function to check if we've crossed into a new day and reset daily stats
    const checkAndHandleDateRollover = () => {
        browser.storage.local.get(["dailyStats", "historicalStats", "user"], (data) => {
            if (data.dailyStats) {
                const dailyStats: DailyStats = DailyStats.fromJSON(data.dailyStats);
                const today = new Date().toLocaleDateString('en-CA').slice(0, 10);
                
                if (dailyStats.date !== today) {
                    // Save yesterday's stats to historical
                    const historicalStats = data.historicalStats 
                        ? HistoricalStats.fromJSON(data.historicalStats)
                        : new HistoricalStats();
                    
                    historicalStats.stats[dailyStats.date] = dailyStats.completedSessions || [];
                    
                    // Reset daily stats for new day
                    dailyStats.date = today;
                    dailyStats.completedSessions = [];
                    
                    browser.storage.local.set({ 
                        historicalStats: historicalStats.toJSON(), 
                        dailyStats: dailyStats.toJSON() 
                    });
                    
                    // Sync to server for Pro users
                    if (data.user?.isPro) {
                        syncAddHistoricalDay(
                            dailyStats.date,
                            historicalStats.stats[dailyStats.date].map(s => s.toJSON())
                        );
                        syncUpdateDailyStats(dailyStats.toJSON());
                    }
                }
            }
        });
    };

    browser.runtime.onStartup.addListener(() => {
        // Check and handle date rollover first
        checkAndHandleDateRollover();
        
        browser.storage.local.get(["session", "user"], (data) => {
            if (data.session) {
                const session: Session = Session.fromJSON(data.session);
                // If session was running when browser closed, pause it
                if (session.status === SessionStatus.Running) {
                    // Accumulate elapsed time before pausing
                    const now = new Date();
                    session.accumulatedTime = session.getElapsedTime(now);
                    session.currentRunStartedAt = null;
                    session.status = SessionStatus.Paused;
                    browser.runtime.sendMessage({ action: "updateSession", session });
                    browser.storage.local.set({ session: session.toJSON() });
                }
            }
            
            // Reconnect WebSocket for Pro users (will sync state after connection)
            if (data.user?.isPro && data.user?.authToken) {
                initializeWebSocket(data.user.authToken);
            }
        });
    });

    const updateTime = () => {
        browser.storage.local.get(["session"], (data) => {
            let session: Session = Session.fromJSON(data.session);
            const now = new Date();
            
            if (session && session.timerState === TimerState.Focus) {
                // Check if the session has ended using timestamp-based calculation
                if (session.isComplete(now)) {
                    clearInterval(timer!);
                    timer = null;

                    browser.storage.local.get(["dailyStats", "settings", "user"], (data) => {
                        const settings: Settings = Settings.fromJSON(data.settings);
                        updateCachedSettings(settings);
                        const dailyStats: DailyStats = DailyStats.fromJSON(data.dailyStats);

                        // Show notification for end of focus session
                        if (settings.notificationsEnabled && typeof browser.notifications !== 'undefined') {
                            browser.notifications.create({
                                type: 'basic',
                                iconUrl: browser.runtime.getURL('/icon/256-green.png'),
                                title: 'Focus Session Complete',
                                message: 'Time for a break'
                            });
                        }

                        // Play notification sound if enabled
                        playNotificationSound(settings);

                        const completedSession = CompletedSession.fromJSON({
                            totalTime: session.getTotalTimeForCurrentState(),
                            timeStarted: session.createdAt.toISOString(),
                            timeEnded: new Date().toISOString(),
                            project: session.project || "General"
                        });

                        if (dailyStats.date !== new Date().toLocaleDateString('en-CA').slice(0, 10)) {

                            const dailyStatsSnapshot = DailyStats.fromJSON(dailyStats.toJSON());

                            browser.storage.local.get(["historicalStats"], (historicalData) => {
                                const historicalStats = HistoricalStats.fromJSON(historicalData.historicalStats);
                                historicalStats.stats[dailyStatsSnapshot.date] = dailyStatsSnapshot.completedSessions ? dailyStatsSnapshot.completedSessions : [];
                                browser.storage.local.set({ historicalStats: historicalStats.toJSON() });

                                // Sync to server for Pro users
                                if (data.user?.isPro) {
                                    syncAddHistoricalDay(
                                        dailyStatsSnapshot.date,
                                        dailyStatsSnapshot.completedSessions?.map(s => s.toJSON()) || []
                                    );
                                }
                            });

                            dailyStats.date = new Date().toLocaleDateString('en-CA').slice(0, 10);
                            dailyStats.completedSessions = [];
                            
                            // Sync the reset daily stats to backend for Pro users
                            if (data.user?.isPro) {
                                syncUpdateDailyStats(dailyStats.toJSON());
                            }
                        }

                        dailyStats.completedSessions.push(completedSession);

                        // Check if we need a long break based on today's completed sessions
                        const completedSessionsToday = dailyStats.completedSessions.length;
                        const shouldTakeLongBreak = settings.longBreakEnabled && 
                            completedSessionsToday % settings.longBreakInterval === 0;

                        if (shouldTakeLongBreak) {
                            session.timerState = TimerState.LongBreak;
                            session.longBreakDuration = settings.longBreakTime;
                        } else {
                            session.timerState = TimerState.ShortBreak;
                            session.shortBreakDuration = settings.shortBreakTime;
                        }

                        session.accumulatedTime = 0;
                        session.createdAt = new Date();

                        if (settings.breakAutoStart) {
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();
                            setBadge(timeDisplayFormatBadge(session.getTotalTimeForCurrentState(), settings.badgeDisplayFormat), "green");
                            timer = setInterval(() => updateTime(), 1000);
                        } else {
                            session.status = SessionStatus.Stopped;
                            session.currentRunStartedAt = null;
                            setBadge("", "green");
                        }

                        browser.storage.local.set({ dailyStats: dailyStats.toJSON(), session: session.toJSON() });
                        
                        // Sync daily stats to server for Pro users
                        if (data.user?.isPro) {
                            syncUpdateDailyStats(dailyStats.toJSON());
                            
                            // Sync the new break state to backend WebSocket
                            if (wsClient?.isConnected()) {
                                const breakType = session.timerState === TimerState.ShortBreak ? 'short' : 'long';
                                const autoStart = session.status === SessionStatus.Running;
                                wsClient.transitionToBreak(breakType, autoStart);
                            }
                        }
                        
                        browser.runtime.sendMessage({ action: "updateSession", session });
                    });

                } else {
                    // Session still running - update badge with remaining time
                    setBadge(timeDisplayFormatBadge(session.getRemainingTime(now), cachedBadgeDisplayFormat), "red");
                    browser.runtime.sendMessage({ action: "updateSession", session });
                }
            } else if (session && session.timerState === TimerState.ShortBreak) {
                // Check if the short break has ended
                if (session.isComplete(now)) {
                    clearInterval(timer!);
                    timer = null;

                    browser.storage.local.get(["settings"], (data) => {
                        const settings: Settings = Settings.fromJSON(data.settings);
                        updateCachedSettings(settings);
                        if (settings) {
                            // Show notification for end of break
                            if (settings.notificationsEnabled && typeof browser.notifications !== 'undefined') {
                                browser.notifications.create({
                                    type: 'basic',
                                    iconUrl: browser.runtime.getURL('/icon/256.png'),
                                    title: 'Break Ended',
                                    message: 'Time to focus again'
                                });
                            }

                            // Play notification sound if enabled
                            playNotificationSound(settings);

                            session.timerState = TimerState.Focus;
                            session.accumulatedTime = 0;
                            session.createdAt = new Date();
                            session.focusDuration = settings.focusTime;

                            if (settings.focusAutoStart) {
                                session.status = SessionStatus.Running;
                                session.currentRunStartedAt = new Date();
                                timer = setInterval(() => updateTime(), 1000);
                                setBadge(timeDisplayFormatBadge(session.getTotalTimeForCurrentState(), settings.badgeDisplayFormat), "red");
                            } else {
                                session.status = SessionStatus.Stopped;
                                session.currentRunStartedAt = null;
                                setBadge("", "red");
                            }

                            browser.storage.local.set({ session: session.toJSON() });
                            
                            // Sync new focus state to backend for Pro users (after short break)
                            browser.storage.local.get(["user"], (userData) => {
                                if (userData.user?.isPro && wsClient?.isConnected()) {
                                    if (session.status === SessionStatus.Running) {
                                        // Start new focus session
                                        wsClient.startSession({
                                            project: session.project,
                                            focusDuration: session.focusDuration,
                                            shortBreakDuration: session.shortBreakDuration,
                                            longBreakDuration: session.longBreakDuration
                                        });
                                    } else {
                                        // Focus didn't auto-start
                                        wsClient.stopSession();
                                    }
                                }
                            });
                            
                            browser.runtime.sendMessage({ action: "updateSession", session });
                        }
                    });

                } else {
                    // Break still running - update badge with remaining time
                    setBadge(timeDisplayFormatBadge(session.getRemainingTime(now), cachedBadgeDisplayFormat), "green");
                    browser.runtime.sendMessage({ action: "updateSession", session });
                }
            } else if (session && session.timerState === TimerState.LongBreak) {
                // Check if the long break has ended
                if (session.isComplete(now)) {
                    clearInterval(timer!);
                    timer = null;

                    browser.storage.local.get(["settings"], (data) => {
                        const settings: Settings = Settings.fromJSON(data.settings);
                        updateCachedSettings(settings);
                        if (settings) {
                            // Show notification for end of long break
                            if (settings.notificationsEnabled && typeof browser.notifications !== 'undefined') {
                                browser.notifications.create({
                                    type: 'basic',
                                    iconUrl: browser.runtime.getURL('/icon/256.png'),
                                    title: 'Long Break Ended',
                                    message: 'Time to focus again'
                                });
                            }

                            // Play notification sound if enabled
                            playNotificationSound(settings);

                            session.timerState = TimerState.Focus;
                            session.accumulatedTime = 0;
                            session.createdAt = new Date();
                            session.focusDuration = settings.focusTime;

                            if (settings.focusAutoStart) {
                                session.status = SessionStatus.Running;
                                session.currentRunStartedAt = new Date();
                                timer = setInterval(() => updateTime(), 1000);
                                setBadge(timeDisplayFormatBadge(session.getTotalTimeForCurrentState(), settings.badgeDisplayFormat), "red");
                            } else {
                                session.status = SessionStatus.Stopped;
                                session.currentRunStartedAt = null;
                                setBadge("", "red");
                            }

                            browser.storage.local.set({ session: session.toJSON() });
                            
                            // Sync new focus state to backend for Pro users (after long break)
                            browser.storage.local.get(["user"], (userData) => {
                                if (userData.user?.isPro && wsClient?.isConnected()) {
                                    if (session.status === SessionStatus.Running) {
                                        // Start new focus session
                                        wsClient.startSession({
                                            project: session.project,
                                            focusDuration: session.focusDuration,
                                            shortBreakDuration: session.shortBreakDuration,
                                            longBreakDuration: session.longBreakDuration
                                        });
                                    } else {
                                        // Focus didn't auto-start
                                        wsClient.stopSession();
                                    }
                                }
                            });
                            
                            browser.runtime.sendMessage({ action: "updateSession", session });
                        }
                    });

                } else {
                    // Long break still running - update badge with remaining time
                    setBadge(timeDisplayFormatBadge(session.getRemainingTime(now), cachedBadgeDisplayFormat), "green");
                    browser.runtime.sendMessage({ action: "updateSession", session });
                }
            }
        });
    };

    browser.runtime.onMessage.addListener(
        (request: { action: string, project?: string, params?: any }, _sender, sendResponse) => {
            const validActions = ["startTimer", "pauseTimer", "resumeTimer", "stopTimer", "startShortBreak", "startLongBreak", "skipBreak", "updateSessionProject"];
            if (validActions.includes(request.action)) {
                browser.storage.local.get(["session", "settings"], (data) => {
                    let session: Session = Session.fromJSON(data.session);
                    const settings: Settings = Settings.fromJSON(data.settings);
                    updateCachedSettings(settings);

                    switch (request.action) {
                        case "startTimer":
                            session.timerState = TimerState.Focus;
                            session.createdAt = new Date();
                            session.focusDuration = settings.focusTime;
                            session.shortBreakDuration = settings.shortBreakTime;
                            session.longBreakDuration = settings.longBreakTime;
                            session.accumulatedTime = 0;
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();

                            timer = setInterval(() => updateTime(), 1000);
                            
                            // Send to WebSocket
                            if (wsClient?.isConnected()) {
                                wsClient.startSession({
                                    project: session.project,
                                    focusDuration: session.focusDuration,
                                    shortBreakDuration: session.shortBreakDuration,
                                    longBreakDuration: session.longBreakDuration
                                });
                            }
                            break;
                        case "pauseTimer":
                            // Accumulate elapsed time before pausing
                            session.accumulatedTime = session.getElapsedTime(new Date());
                            session.currentRunStartedAt = null;
                            session.status = SessionStatus.Paused;
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            
                            // Send to WebSocket
                            if (wsClient?.isConnected()) {
                                wsClient.pauseSession();
                            }
                            break;
                        case "resumeTimer":
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();
                            timer = setInterval(() => updateTime(), 1000);
                            
                            // Send to WebSocket
                            if (wsClient?.isConnected()) {
                                wsClient.resumeSession();
                            }
                            break;
                        case "stopTimer":
                            session.status = SessionStatus.Stopped;
                            session.currentRunStartedAt = null;
                            session.accumulatedTime = 0;
                            session.timerState = TimerState.Focus;
                            session.createdAt = new Date();
                            setBadge("", "red");

                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            
                            // Send to WebSocket
                            if (wsClient?.isConnected()) {
                                wsClient.stopSession();
                            }
                            break;
                        case "startShortBreak":
                            session.timerState = TimerState.ShortBreak;
                            session.createdAt = new Date();
                            session.focusDuration = settings.focusTime;
                            session.shortBreakDuration = settings.shortBreakTime;
                            session.longBreakDuration = settings.longBreakTime;
                            session.accumulatedTime = 0;
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();
                            timer = setInterval(() => updateTime(), 1000);
                            
                            // Send to WebSocket
                            if (wsClient?.isConnected()) {
                                wsClient.transitionToBreak('short', true);
                            }
                            break;
                        case "startLongBreak":
                            session.timerState = TimerState.LongBreak;
                            session.createdAt = new Date();
                            session.focusDuration = settings.focusTime;
                            session.shortBreakDuration = settings.shortBreakTime;
                            session.longBreakDuration = settings.longBreakTime;
                            session.accumulatedTime = 0;
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();
                            timer = setInterval(() => updateTime(), 1000);
                            
                            // Send to WebSocket
                            if (wsClient?.isConnected()) {
                                wsClient.transitionToBreak('long', true);
                            }
                            break;
                        case "skipBreak":
                            session.timerState = TimerState.Focus;
                            session.status = SessionStatus.Stopped;
                            session.currentRunStartedAt = null;
                            session.accumulatedTime = 0;
                            session.createdAt = new Date();
                            session.focusDuration = settings.focusTime;
                            session.shortBreakDuration = settings.shortBreakTime;
                            session.longBreakDuration = settings.longBreakTime;
                            setBadge("", "red");
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            
                            // Send to WebSocket
                            if (wsClient?.isConnected()) {
                                wsClient.skipBreak();
                            }
                            break;
                        case "updateSessionProject":
                            if (request.project) {
                                session.project = request.project;
                                
                                // Send to WebSocket
                                if (wsClient?.isConnected()) {
                                    wsClient.updateSessionProject(request.project);
                                }
                            }
                            break;
                    }

                    browser.runtime.sendMessage({ action: "updateSession", session });
                    browser.storage.local.set({ session: session.toJSON() });
                });
            }

        }
    );



    const setBadge = (text: string, color: string) => {
        if (import.meta.env.BROWSER === 'firefox') {
            browser.browserAction.setBadgeText({ text });

            if (color === "red") {
                browser.browserAction.setBadgeBackgroundColor({ color: "#ff1d25" });
                // @ts-expect-error: setBadgeTextColor is not in types yet
                browser.browserAction.setBadgeTextColor({ color: "#ffffff" });

            } else if (color === "green") {
                browser.browserAction.setBadgeBackgroundColor({ color: "#4ade80" });
                // @ts-expect-error: setBadgeTextColor is not in types yet
                browser.browserAction.setBadgeTextColor({ color: "#333333" });
            }

        } else {
            browser.action.setBadgeText({ text });

            if (color === "red") {
                browser.action.setBadgeBackgroundColor({ color: "#ff1d25" });
                browser.action.setBadgeTextColor({ color: "#ffffff" });
            } else if (color === "green") {
                browser.action.setBadgeBackgroundColor({ color: "#4ade80" });
                browser.action.setBadgeTextColor({ color: "#333333" });
            }

        }
    }

    // Website blocking functionality
    const checkUrlBlockStatus = (tab: any) => {
        if (!tab.url || !tab.id) return;

        browser.storage.local.get(['session', 'blockedWebsites'], (data) => {
            if (!data.session || !data.blockedWebsites) return;

            const session: Session = Session.fromJSON(data.session);
            const blockedWebsites: BlockedWebsites = BlockedWebsites.fromJSON(data.blockedWebsites);

            // Only block during active focus sessions and if blocking is enabled
            if (session.timerState !== TimerState.Focus || session.status !== SessionStatus.Running || !blockedWebsites.enabled) {
                return;
            }

            // Get current tab URL hostname
            const currentTabUrl = extractHostnameAndDomain(tab.url);
            if (!currentTabUrl) return;

            // Check if current hostname is in blocked websites set
            const isBlocked = blockedWebsites.isWebsiteBlocked(currentTabUrl);
            
            if (isBlocked) {
                const blockedPageUrl = browser.runtime.getURL(`/blocked.html?site=${encodeURIComponent(currentTabUrl)}`);
                // Redirect to blocked page
                browser.tabs.update(tab.id, { url: blockedPageUrl });
            }
        });
    };

    // Listen for tab updates
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.active && tab.url) {
            checkUrlBlockStatus(tab);
        }
    });

    // Listen for tab activation
    browser.tabs.onActivated.addListener((activeInfo) => {
        browser.tabs.get(activeInfo.tabId, (tab) => {
            if (tab.url) {
                checkUrlBlockStatus(tab);
            }
        });
    });

    // Listen for window focus changes
    browser.windows.onFocusChanged.addListener((windowId) => {
        if (windowId !== browser.windows.WINDOW_ID_NONE) {
            browser.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                if (tabs[0] && tabs[0].url) {
                    checkUrlBlockStatus(tabs[0]);
                }
            });
        }
    });

});