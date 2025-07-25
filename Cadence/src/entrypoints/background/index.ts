import { Timer } from "lucide-react";
import { TimerState } from "../models/TimerState";
import { ChartType } from "../models/ChartType";
import { timeDisplayFormatBadge } from "@/lib/utils";
import { DailyStats } from "../models/DailyStats";
import { CompletedSession } from "../models/CompletedSession";
import { HistoricalStats } from "../models/HistoricalStats";
import { Session } from "../models/Session";
import { Settings } from "../models/Settings";

export default defineBackground(() => {
    browser.runtime.onInstalled.addListener((object) => {
        if (object.reason === 'install') {
            browser.runtime.openOptionsPage();
        }

        browser.storage.local.get(["settings", "session", "dailyStats", "historicalStats"], (data) => {
            if (!data.settings) {
                const defaultSettings: Settings = Settings.fromJSON({
                    focusTime: 25 * 60, // Default to 25 minutes in seconds
                    shortBreakTime: 5 * 60, // Default to 5 minutes in seconds
                    longBreakTime: 15 * 60, // Default to 15 minutes in seconds
                    longBreakInterval: 4, // Default to every 4 cycles
                    longBreakEnabled: true, // Default to long breaks enabled
                    breakAutoStart: true, // Default to auto-start breaks
                    focusAutoStart: false, // Default to not auto-start focus
                    dailySessionsGoal: 10 // Default to 10 sessions per day
                });

                browser.storage.local.set({ settings: defaultSettings.toJSON() });
            } else {
                // Backward compatibility for dailySessionsGoal and preferredChartType
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
                
                if (needsUpdate) {
                    browser.storage.local.set({ settings: updatedSettings.toJSON() });
                }
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

            if (!data.session) {
                const defaultSession: Session = Session.fromJSON({
                    elapsedTime: 0,
                    timerState: TimerState.Focus,
                    totalTime: data.settings ? data.settings.focusTime : 25 * 60, // Default to 25 minutes in seconds
                    isStopped: true,
                    isPaused: false,
                    timeStarted: new Date().toISOString(),
                });

                browser.storage.local.set({ session: defaultSession.toJSON() });
            }
        });
    });

    let timer: NodeJS.Timeout | null = null;

    browser.runtime.onStartup.addListener(() => {
        browser.storage.local.get(["session"], (data) => {
            if (data.session) {
                const session: Session = Session.fromJSON(data.session);
                if (!session.isStopped && !session.isPaused) {
                    session.isPaused = true;
                    browser.runtime.sendMessage({ action: "updateSession", session });
                    browser.storage.local.set({ session: session.toJSON() });
                }
            }
        });
    });

    const updateTime = () => {
        browser.storage.local.get(["session"], (data) => {
            let session: Session = Session.fromJSON(data.session);
            if (session && session.timerState === TimerState.Focus) {
                session.elapsedTime += 1;

                // Check if the session has ended
                if (session.elapsedTime >= session.totalTime) {
                    clearInterval(timer!);
                    timer = null;

                    // Show notification for end of focus session
                    if (typeof browser.notifications !== 'undefined') {
                        browser.notifications.create({
                            type: 'basic',
                            iconUrl: browser.runtime.getURL('/icon/256-green.png'),
                            title: 'Focus Session Complete',
                            message: 'Time for a break'
                        });
                    }

                    browser.storage.local.get(["dailyStats", "settings"], (data) => {
                        const settings: Settings = Settings.fromJSON(data.settings);
                        const dailyStats: DailyStats = DailyStats.fromJSON(data.dailyStats);

                        const completedSession = CompletedSession.fromJSON({
                            totalTime: session.totalTime,
                            timeStarted: session.timeStarted.toISOString(),
                            timeEnded: new Date().toISOString()
                        });

                        if (dailyStats.date !== new Date().toLocaleDateString('en-CA').slice(0, 10)) {
                            browser.storage.local.get(["historicalStats"], (data) => {
                                const historicalStats = HistoricalStats.fromJSON(data.historicalStats);
                                historicalStats.stats[dailyStats.date] = dailyStats.completedSessions ? dailyStats.completedSessions : [];
                                browser.storage.local.set({ historicalStats: historicalStats.toJSON() });
                            });

                            dailyStats.date = new Date().toLocaleDateString('en-CA').slice(0, 10);
                            dailyStats.completedSessions = [];
                        }

                        dailyStats.completedSessions.push(completedSession);

                        session.timerState = TimerState.ShortBreak;
                        session.elapsedTime = 0;
                        session.timeStarted = new Date();
                        session.totalTime = settings.shortBreakTime;

                        if (settings.breakAutoStart) {
                            session.isStopped = false;
                            setBadge(timeDisplayFormatBadge(session.totalTime), "green");
                            timer = setInterval(() => updateTime(), 1000);
                        } else {
                            session.isStopped = true;
                            setBadge("", "green");
                        }

                        browser.storage.local.set({ dailyStats: dailyStats.toJSON(), session: session.toJSON() });
                        browser.runtime.sendMessage({ action: "updateSession", session });
                    });

                } else {
                    browser.storage.local.set({ session: session.toJSON() });

                    setBadge(timeDisplayFormatBadge(session.totalTime - session.elapsedTime), "red");
                    browser.runtime.sendMessage({ action: "updateSession", session });
                }
            } else if (session && session.timerState === TimerState.ShortBreak) {
                session.elapsedTime += 1;

                // Check if the short break has ended
                if (session.elapsedTime >= session.totalTime) {
                    clearInterval(timer!);
                    timer = null;

                    // Show notification for end of break
                    if (typeof browser.notifications !== 'undefined') {
                        browser.notifications.create({
                            type: 'basic',
                            iconUrl: browser.runtime.getURL('/icon/256.png'),
                            title: 'Break Ended',
                            message: 'Time to focus again'
                        });
                    }

                    browser.storage.local.get(["settings"], (data) => {
                        const settings: Settings = Settings.fromJSON(data.settings);
                        if (settings) {
                            session.timerState = TimerState.Focus;
                            session.elapsedTime = 0;
                            session.timeStarted = new Date();
                            session.totalTime = settings.focusTime;

                            if (settings.focusAutoStart) {
                                session.isStopped = false;
                                timer = setInterval(() => updateTime(), 1000);
                                setBadge(timeDisplayFormatBadge(session.totalTime), "red");
                            } else {
                                session.isStopped = true;
                                setBadge("", "red");
                            }

                            browser.storage.local.set({ session: session.toJSON() });
                            browser.runtime.sendMessage({ action: "updateSession", session });
                        }
                    });

                } else {
                    browser.storage.local.set({ session: session.toJSON() });

                    setBadge(timeDisplayFormatBadge(session.totalTime - session.elapsedTime), "green");
                    browser.runtime.sendMessage({ action: "updateSession", session });
                }
            }
        });
    };

    browser.runtime.onMessage.addListener(
        (request: { action: string, params?: any }, _sender, _sendResponse) => {
            const validActions = ["startTimer", "pauseTimer", "resumeTimer", "stopTimer", "startShortBreak", "skipBreak"];
            if (validActions.includes(request.action)) {
                browser.storage.local.get(["session", "settings"], (data) => {
                    let session: Session = Session.fromJSON(data.session);
                    const settings: Settings = Settings.fromJSON(data.settings);

                    switch (request.action) {
                        case "startTimer":
                            session.timerState = TimerState.Focus;
                            session.timeStarted = new Date();
                            session.totalTime = settings.focusTime;
                            session.isStopped = false;

                            timer = setInterval(() => updateTime(), 1000);
                            break;
                        case "pauseTimer":
                            session.isPaused = true;
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            break;
                        case "resumeTimer":
                            session.isPaused = false;
                            timer = setInterval(() => updateTime(), 1000);
                            break;
                        case "stopTimer":
                            session.isPaused = false;
                            session.isStopped = true;
                            session.elapsedTime = 0;
                            session.timerState = TimerState.Focus;
                            session.timeStarted = new Date();
                            setBadge("", "red");

                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            break;
                        case "startShortBreak":
                            session.timerState = TimerState.ShortBreak;
                            session.timeStarted = new Date();
                            session.totalTime = settings.shortBreakTime;
                            session.isStopped = false;
                            timer = setInterval(() => updateTime(), 1000);
                            break;
                        case "skipBreak":
                            session.timerState = TimerState.Focus;
                            session.isPaused = false;
                            session.elapsedTime = 0;
                            session.timeStarted = new Date();
                            session.totalTime = settings.focusTime;
                            session.isStopped = true;
                            setBadge("", "red");
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
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

});