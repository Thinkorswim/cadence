import { TimerState } from "./TimerState";
import { SessionStatus } from "./SessionStatus";

export class Session {
  constructor(
    public accumulatedTime: number = 0, // Time accumulated in seconds before current run
    public createdAt: Date = new Date(), // When the session was created
    public currentRunStartedAt: Date | null = null, // When the current run started (null if not running)
    public timerState: TimerState = TimerState.Focus, // Current state of the timer
    public status: SessionStatus = SessionStatus.Stopped, // Session status
    public project: string = "General", // Project name for this session
    public focusDuration: number = 25 * 60, // Focus duration in seconds (default 25 minutes)
    public shortBreakDuration: number = 5 * 60, // Short break duration in seconds (default 5 minutes)
    public longBreakDuration: number = 15 * 60 // Long break duration in seconds (default 15 minutes)
  ) { }

  /**
   * Calculate the current elapsed time based on the current timestamp.
   * If the session is running, includes time since currentRunStartedAt.
   */
  getElapsedTime(now: Date = new Date()): number {
    if (this.status === SessionStatus.Running && this.currentRunStartedAt !== null) {
      const runningTime = Math.floor((now.getTime() - this.currentRunStartedAt.getTime()) / 1000);
      return this.accumulatedTime + runningTime;
    }
    return this.accumulatedTime;
  }

  /**
   * Get the remaining time for the current timer state.
   */
  getRemainingTime(now: Date = new Date()): number {
    const totalTime = this.getTotalTimeForCurrentState();
    return Math.max(0, totalTime - this.getElapsedTime(now));
  }

  /**
   * Get the total time for the current timer state.
   */
  getTotalTimeForCurrentState(): number {
    switch (this.timerState) {
      case TimerState.Focus:
        return this.focusDuration;
      case TimerState.ShortBreak:
        return this.shortBreakDuration;
      case TimerState.LongBreak:
        return this.longBreakDuration;
      default:
        return this.focusDuration;
    }
  }

  /**
   * Check if the current timer state has completed.
   */
  isComplete(now: Date = new Date()): boolean {
    return this.getElapsedTime(now) >= this.getTotalTimeForCurrentState();
  }

  toJSON(): {
    accumulatedTime: number;
    createdAt: string;
    currentRunStartedAt: string | null;
    timerState: TimerState;
    status: SessionStatus;
    project: string;
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
  } {
    return {
      accumulatedTime: this.accumulatedTime,
      createdAt: this.createdAt.toISOString(),
      currentRunStartedAt: this.currentRunStartedAt?.toISOString() ?? null,
      timerState: this.timerState,
      status: this.status,
      project: this.project,
      focusDuration: this.focusDuration,
      shortBreakDuration: this.shortBreakDuration,
      longBreakDuration: this.longBreakDuration,
    };
  }

  static fromJSON(json: {
    accumulatedTime: number;
    createdAt: string;
    currentRunStartedAt: string | null;
    timerState: TimerState;
    status: SessionStatus;
    project?: string;
    focusDuration?: number;
    shortBreakDuration?: number;
    longBreakDuration?: number;
  }): Session {
    return new Session(
      json.accumulatedTime,
      new Date(json.createdAt),
      json.currentRunStartedAt ? new Date(json.currentRunStartedAt) : null,
      json.timerState,
      json.status,
      json.project ?? "General",
      json.focusDuration ?? 25 * 60,
      json.shortBreakDuration ?? 5 * 60,
      json.longBreakDuration ?? 15 * 60
    );
  }
}