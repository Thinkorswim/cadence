import { Timer } from "lucide-react";
import { TimerState } from "../models/TimerState";
import { timeDisplayFormatBadge } from "@/lib/utils";
import { DailyStats } from "../models/DailyStats";
import { CompletedSession } from "../models/CompletedSession";

export default defineBackground(() => {
    browser.runtime.onInstalled.addListener((object) => {
        if (object.reason === 'install') {
            browser.runtime.openOptionsPage();
        }

        browser.storage.local.get(["settings", "session", "dailyStats", "historicalStats"], (data) => {
            if (!data.settings) {
                const defaultSettings = {
                    focusTime: 25 * 60, // Default to 25 minutes in seconds
                    shortBreakTime: 5 * 60, // Default to 5 minutes in seconds
                    longBreakTime: 15 * 60, // Default to 15 minutes in seconds
                    longBreakInterval: 4, // Default to every 4 cycles
                    longBreakEnabled: true, // Default to long breaks enabled
                    breakAutoStart: true, // Default to auto-start breaks
                    focusAutoStart: true, // Default to auto-start focus
                };
                browser.storage.local.set({ settings: defaultSettings });
            }

            if (!data.dailyStats) {
                const defaultDailyStats = new DailyStats(
                    new Date().toLocaleDateString('en-CA').slice(0, 10),
                    []
                );
                browser.storage.local.set({ dailyStats: defaultDailyStats });
            }

            if (!data.historicalStats) {
                browser.storage.local.set({ historicalStats: {} });
            }

            if (!data.session) {
                const defaultSession = {
                    timerState: TimerState.Focus,
                    elapsedTime: 0,
                    totalTime: 0,
                    isStopped: true, // Default to stopped state
                    isPaused: false, // Default to not paused
                };
                browser.storage.local.set({ session: defaultSession });
            }
        });
    });

    let timer: NodeJS.Timeout | null = null;

    browser.runtime.onStartup.addListener(() => {
        browser.storage.local.get(["session"], (data) => {
            if (data.session && !data.session.isStopped && !data.session.isPaused) {
                data.session.isPaused = true;
                browser.runtime.sendMessage({ action: "updateSession", session: data.session });
                browser.storage.local.set({ session: data.session });
            }
        });
    });

    const updateTime = () => {
        browser.storage.local.get(["session"], (data) => {
            let session = data.session;
            if (session && session.timerState === TimerState.Focus) {
                session.elapsedTime += 1; // Increment elapsed time by 1 second

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

                    // TODO: Add session to history
                    browser.storage.local.get(["dailyStats", "settings"], (data) => {
                        const settings = data.settings;
                        const dailyStats = data.dailyStats || new DailyStats(
                            new Date().toLocaleDateString('en-CA').slice(0, 10),
                            []
                        );

                        const completedSession = CompletedSession.fromJSON({
                            totalTime: session.totalTime,
                            timeStarted: session.timeStarted,
                            timeEnded: new Date()
                        });

                        // if today is not the same as the dailyStats date, reset the dailyStats
                        if (dailyStats.date !== new Date().toLocaleDateString('en-CA').slice(0, 10)) {
                            // add the dailyStats to historicalStats where historicalStats is a map of dates to DailyStats
                            browser.storage.local.get(["historicalStats"], (data) => {
                                const historicalStats = data.historicalStats || {};
                                historicalStats[dailyStats.date] = dailyStats.completedSessions;
                                browser.storage.local.set({ historicalStats });
                            });

                            // reset the dailyStats
                            dailyStats.date = new Date().toLocaleDateString('en-CA').slice(0, 10);
                            dailyStats.completedSessions = [];
                        }

                        dailyStats.completedSessions.push(CompletedSession.fromJSON(completedSession));

                        session.timerState = TimerState.ShortBreak;
                        session.elapsedTime = 0;
                        session.timeStarted = new Date();
                        session.timeEnded = null;
                        session.totalTime = settings.shortBreakTime;

                        if (settings.breakAutoStart) {
                            session.isStopped = false; // Set the session as not stopped
                            setBadge(timeDisplayFormatBadge(session.totalTime), "green");
                            timer = setInterval(() => updateTime(), 1000);
                        } else {
                            session.isStopped = true; // Set the session as stopped
                            setBadge("", "green");
                        }

                        browser.storage.local.set({ dailyStats, session });
                        browser.runtime.sendMessage({ action: "updateSession", session });
                    });

                } else {
                    browser.storage.local.set({ session });

                    // Update the badge with the elapsed time
                    setBadge(timeDisplayFormatBadge(session.totalTime - session.elapsedTime), "red");

                    // broadcast message with the session data
                    browser.runtime.sendMessage({ action: "updateSession", session });
                }
            } else if (session && session.timerState === TimerState.ShortBreak) {
                session.elapsedTime += 1; // Increment elapsed time by 1 second

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

                    // get the settings to see the short break time
                    browser.storage.local.get(["settings"], (data) => {
                        const settings = data.settings;
                        if (settings) {
                            session.timerState = TimerState.Focus;
                            session.elapsedTime = 0;
                            session.timeStarted = new Date();
                            session.timeEnded = null;
                            session.totalTime = settings.focusTime;

                            if (settings.focusAutoStart) {
                                session.isStopped = false; // Set the session as not stopped
                                timer = setInterval(() => updateTime(), 1000);
                                setBadge(timeDisplayFormatBadge(session.totalTime), "red");
                            } else {
                                session.isStopped = true; // Set the session as stopped
                                setBadge("", "red");
                            }

                            browser.storage.local.set({ session });
                            browser.runtime.sendMessage({ action: "updateSession", session });
                        }
                    });

                } else {

                    browser.storage.local.set({ session });

                    // Update the badge with the elapsed time
                    setBadge(timeDisplayFormatBadge(session.totalTime - session.elapsedTime), "green");
                    // broadcast message with the session data
                    browser.runtime.sendMessage({ action: "updateSession", session });
                }
            }
        });
    };

    browser.runtime.onMessage.addListener(
        (request: { action: string, params?: any }, sender, sendResponse) => {
            const validActions = ["startTimer", "pauseTimer", "resumeTimer", "stopTimer", "startShortBreak", "skipBreak"];
            if (validActions.includes(request.action)) {
                browser.storage.local.get(["session", "settings"], (data) => {
                    let session = data.session;
                    const settings = data.settings;

                    switch (request.action) {
                        case "startTimer":
                            session.timerState = TimerState.Focus; // Assuming TimerState is imported from the correct module
                            session.timeStarted = new Date();
                            session.totalTime = settings.focusTime; // Set total time based on settings
                            session.isStopped = false; // Set the session as not stopped

                            timer = setInterval(() => updateTime(), 1000);
                            break;
                        case "pauseTimer":
                            session.isPaused = true; // Set the session as paused
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            break;
                        case "resumeTimer":
                            session.isPaused = false; // Set the session as not paused
                            timer = setInterval(() => updateTime(), 1000);
                            break;
                        case "stopTimer":
                            session.isPaused = false; // Set the session as not paused
                            session.isStopped = true; // Set the session as stopped
                            session.elapsedTime = 0;
                            session.timerState = TimerState.Focus;
                            session.timeStarted = new Date();
                            session.timeEnded = null;
                            setBadge("", "red");

                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            break;
                        case "startShortBreak":
                            session.timerState = TimerState.ShortBreak; // Assuming TimerState is imported from the correct
                            session.timeStarted = new Date();
                            session.totalTime = settings.shortBreakTime; // Set total time based on settings
                            session.isStopped = false; // Set the session as not stopped
                            timer = setInterval(() => updateTime(), 1000);
                            break;
                        case "skipBreak":
                            session.timerState = TimerState.Focus; // Skip the break and go back to focus
                            session.isPaused = false; // Set the session as not paused
                            session.elapsedTime = 0; // Reset elapsed time
                            session.timeStarted = new Date();
                            session.timeEnded = null;
                            session.totalTime = settings.focusTime; // Set total time based on settings
                            session.isStopped = true; // Set the session as stopped
                            setBadge("", "red");
                            if (timer) {
                                clearInterval(timer);
                                timer = null;
                            }
                            break;
                    }

                    browser.runtime.sendMessage({ action: "updateSession", session });
                    browser.storage.local.set({ session }); // Persist updated session
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