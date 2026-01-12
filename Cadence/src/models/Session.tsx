import { TimerState } from "./TimerState";
import { SessionStatus } from "./SessionStatus";

export class Session {
  constructor(
    public accumulatedTime: number = 0, // Time accumulated in seconds before current run
    public totalTime: number = 0, // Total time for the session in seconds
    public createdAt: Date = new Date(), // When the session was created
    public currentRunStartedAt: Date | null = null, // When the current run started (null if not running)
    public timerState: TimerState = TimerState.Focus, // Current state of the timer
    public status: SessionStatus = SessionStatus.Stopped, // Session status
    public project: string = "General" // Project name for this session
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
   * Get the remaining time for this session.
   */
  getRemainingTime(now: Date = new Date()): number {
    return Math.max(0, this.totalTime - this.getElapsedTime(now));
  }

  /**
   * Check if the session timer has completed.
   */
  isComplete(now: Date = new Date()): boolean {
    return this.getElapsedTime(now) >= this.totalTime;
  }

  toJSON(): {
    accumulatedTime: number;
    totalTime: number;
    createdAt: string;
    currentRunStartedAt: string | null;
    timerState: TimerState;
    status: SessionStatus;
    project: string;
  } {
    return {
      accumulatedTime: this.accumulatedTime,
      totalTime: this.totalTime,
      createdAt: this.createdAt.toISOString(),
      currentRunStartedAt: this.currentRunStartedAt?.toISOString() ?? null,
      timerState: this.timerState,
      status: this.status,
      project: this.project,
    };
  }

  static fromJSON(json: {
    accumulatedTime: number;
    totalTime: number;
    createdAt: string;
    currentRunStartedAt: string | null;
    timerState: TimerState;
    status: SessionStatus;
    project?: string;
  }): Session {
    return new Session(
      json.accumulatedTime,
      json.totalTime,
      new Date(json.createdAt),
      json.currentRunStartedAt ? new Date(json.currentRunStartedAt) : null,
      json.timerState,
      json.status,
      json.project ?? "General"
    );
  }
}