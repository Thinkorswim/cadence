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

export default defineBackground(() => {
    // Offscreen document management
    let offscreenDocumentCreated = false;
    
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
                console.log('Offscreen API not available in this browser');
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
                // Check if we're in Firefox or if offscreen API is not available
                if (import.meta.env.BROWSER === 'firefox' || !browser.offscreen) {
                    try {
                        const audio = new Audio(browser.runtime.getURL('/sounds/alarm.wav'));
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
                        soundFile: '/sounds/alarm.wav',
                        volume: settings.soundVolume
                    });
                }
            }
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    };

    browser.runtime.onInstalled.addListener((object) => {
        if (object.reason === 'install') {
            browser.runtime.openOptionsPage();
        }

        browser.storage.local.get(["settings", "session", "dailyStats", "historicalStats", "blockedWebsites"], (data) => {
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

            if (!data.session || data.session.accumulatedTime === undefined) {
                // Create new session or migrate from old format
                const settings = data.settings ? Settings.fromJSON(data.settings) : null;
                const defaultSession: Session = Session.fromJSON({
                    accumulatedTime: 0,
                    timerState: TimerState.Focus,
                    totalTime: settings ? settings.focusTime : 25 * 60,
                    status: SessionStatus.Stopped,
                    createdAt: new Date().toISOString(),
                    currentRunStartedAt: null,
                    project: settings ? settings.selectedProject : "General"
                });

                browser.storage.local.set({ session: defaultSession.toJSON() });
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

    browser.runtime.onStartup.addListener(() => {
        browser.storage.local.get(["session"], (data) => {
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
                            totalTime: session.totalTime,
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
                        }

                        dailyStats.completedSessions.push(completedSession);

                        // Check if we need a long break based on today's completed sessions
                        const completedSessionsToday = dailyStats.completedSessions.length;
                        const shouldTakeLongBreak = settings.longBreakEnabled && 
                            completedSessionsToday % settings.longBreakInterval === 0;

                        if (shouldTakeLongBreak) {
                            session.timerState = TimerState.LongBreak;
                            session.totalTime = settings.longBreakTime;
                        } else {
                            session.timerState = TimerState.ShortBreak;
                            session.totalTime = settings.shortBreakTime;
                        }

                        session.accumulatedTime = 0;
                        session.createdAt = new Date();

                        if (settings.breakAutoStart) {
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();
                            setBadge(timeDisplayFormatBadge(session.totalTime, settings.badgeDisplayFormat), "green");
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
                            session.totalTime = settings.focusTime;

                            if (settings.focusAutoStart) {
                                session.status = SessionStatus.Running;
                                session.currentRunStartedAt = new Date();
                                timer = setInterval(() => updateTime(), 1000);
                                setBadge(timeDisplayFormatBadge(session.totalTime, settings.badgeDisplayFormat), "red");
                            } else {
                                session.status = SessionStatus.Stopped;
                                session.currentRunStartedAt = null;
                                setBadge("", "red");
                            }

                            browser.storage.local.set({ session: session.toJSON() });
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
                            session.totalTime = settings.focusTime;

                            if (settings.focusAutoStart) {
                                session.status = SessionStatus.Running;
                                session.currentRunStartedAt = new Date();
                                timer = setInterval(() => updateTime(), 1000);
                                setBadge(timeDisplayFormatBadge(session.totalTime, settings.badgeDisplayFormat), "red");
                            } else {
                                session.status = SessionStatus.Stopped;
                                session.currentRunStartedAt = null;
                                setBadge("", "red");
                            }

                            browser.storage.local.set({ session: session.toJSON() });
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
        (request: { action: string, project?: string, params?: any }, _sender, _sendResponse) => {
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
                            session.totalTime = settings.focusTime;
                            session.accumulatedTime = 0;
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();

                            timer = setInterval(() => updateTime(), 1000);
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
                            break;
                        case "resumeTimer":
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();
                            timer = setInterval(() => updateTime(), 1000);
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
                            break;
                        case "startShortBreak":
                            session.timerState = TimerState.ShortBreak;
                            session.createdAt = new Date();
                            session.totalTime = settings.shortBreakTime;
                            session.accumulatedTime = 0;
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();
                            timer = setInterval(() => updateTime(), 1000);
                            break;
                        case "startLongBreak":
                            session.timerState = TimerState.LongBreak;
                            session.createdAt = new Date();
                            session.totalTime = settings.longBreakTime;
                            session.accumulatedTime = 0;
                            session.status = SessionStatus.Running;
                            session.currentRunStartedAt = new Date();
                            timer = setInterval(() => updateTime(), 1000);
                            break;
                        case "skipBreak":
                            session.timerState = TimerState.Focus;
                            session.status = SessionStatus.Stopped;
                            session.currentRunStartedAt = null;
                            session.accumulatedTime = 0;
                            session.createdAt = new Date();
                            session.totalTime = settings.focusTime;
                            setBadge("", "red");
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            break;
                        case "updateSessionProject":
                            if (request.project) {
                                session.project = request.project;
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

        console.log('Checking URL block status for tab:', tab.id, tab.url);

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

            console.log('Current tab hostname:', currentTabUrl);
            console.log('Blocked websites:', Array.from(blockedWebsites.websites));

            // Check if current hostname is in blocked websites set
            const isBlocked = blockedWebsites.isWebsiteBlocked(currentTabUrl);
            
            console.log('Is blocked:', isBlocked);
            
            if (isBlocked) {
                const blockedPageUrl = browser.runtime.getURL(`/blocked.html?site=${encodeURIComponent(currentTabUrl)}`);
                
                console.log('Redirecting to blocked page:', blockedPageUrl);
                // Redirect to blocked page
                browser.tabs.update(tab.id, { url: blockedPageUrl });
            }
        });
    };

    // Listen for tab updates
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        console.log('Tab updated:', tabId, changeInfo, tab);
        if (changeInfo.status === 'complete' && tab.active && tab.url) {
            checkUrlBlockStatus(tab);
        }
    });

    // Listen for tab activation
    browser.tabs.onActivated.addListener((activeInfo) => {
        console.log('Tab activated:', activeInfo);
        browser.tabs.get(activeInfo.tabId, (tab) => {
            if (tab.url) {
                checkUrlBlockStatus(tab);
            }
        });
    });

    // Listen for window focus changes
    browser.windows.onFocusChanged.addListener((windowId) => {
        console.log('Window focus changed:', windowId);
        if (windowId !== browser.windows.WINDOW_ID_NONE) {
            browser.tabs.query({ currentWindow: true, active: true }, (tabs) => {
                if (tabs[0] && tabs[0].url) {
                    checkUrlBlockStatus(tabs[0]);
                }
            });
        }
    });

});