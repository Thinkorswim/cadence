import { TimerState } from "./TimerState";

export class Session {
  constructor(
    public elapsedTime: number = 0, // Time passed in seconds
    public totalTime: number = 0, // Total time for the session in seconds
    public timeStarted: Date = new Date(), // Start time of the session
    public timerState: TimerState = TimerState.Focus, // Current state of the timer
    public isPaused: boolean = false, // Indicates if the session is paused
    public isStopped: boolean = true, // Indicates if the session is stopped
    public project: string = "General" // Project name for this session
  ) { }

  toJSON(): {
    elapsedTime: number;
    totalTime: number;
    timeStarted: string;
    timerState: TimerState;
    isPaused: boolean;
    isStopped: boolean;
    project: string;
  } {
    return {
      elapsedTime: this.elapsedTime,
      totalTime: this.totalTime,
      timeStarted: this.timeStarted.toISOString(),
      timerState: this.timerState,
      isPaused: this.isPaused,
      isStopped: this.isStopped,
      project: this.project,
    };
  }

  static fromJSON(json: {
    elapsedTime: number;
    totalTime: number;
    timerState: TimerState;
    timeStarted: string;
    isPaused: boolean;
    isStopped?: boolean;
    project?: string;
  }): Session {
    return new Session(
      json.elapsedTime,
      json.totalTime,
      new Date(json.timeStarted),
      json.timerState,
      json.isPaused,
      json.isStopped ?? false,
      json.project ?? "General"
    );
  }
}