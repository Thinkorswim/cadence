import { TimerState } from "./TimerState";

export class Session {
  constructor(
    public elapsedTime: number = 0, // Time passed in seconds
    public totalTime: number = 0, // Total time for the session in seconds
    public timeStarted: Date = new Date(), // Start time of the session
    public timerState: TimerState = TimerState.Focus, // Current state of the timer
    public isPaused: boolean = false, // Indicates if the session is paused
    public isStopped: boolean = true // Indicates if the session is stopped
  ) { }

  toJSON(): {
    elapsedTime: number;
    totalTime: number;
    timeStarted: Date;
    timerState: TimerState;
    isPaused: boolean;
    isStopped: boolean;
  } {
    return {
      elapsedTime: this.elapsedTime,
      totalTime: this.totalTime,
      timeStarted: this.timeStarted,
      timerState: this.timerState,
      isPaused: this.isPaused,
      isStopped: this.isStopped,
    };
  }

  static fromJSON(json: {
    elapsedTime: number;
    totalTime: number;
    timerState: TimerState;
    timeStarted: Date;
    isPaused: boolean;
    isStopped?: boolean;
  }): Session {
    return new Session(
      json.elapsedTime,
      json.totalTime,
      json.timeStarted instanceof Date ? json.timeStarted : new Date(json.timeStarted),
      json.timerState,
      json.isPaused,
      json.isStopped ?? false
    );
  }
}