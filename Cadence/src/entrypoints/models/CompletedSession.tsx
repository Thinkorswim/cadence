export class CompletedSession {
  constructor(
    public totalTime: number,
    public timeStarted: Date,
    public timeEnded: Date
  ) {}

  toJSON(): { totalTime: number; timeStarted: string; timeEnded: string } {
    return {
      totalTime: this.totalTime,
      timeStarted: this.timeStarted.toISOString(),
      timeEnded: this.timeEnded.toISOString(),
    };
  }

  static fromJSON(json: { totalTime: number; timeStarted: string; timeEnded: string }): CompletedSession {
    return new CompletedSession(
      json.totalTime,
      new Date(json.timeStarted),
      new Date(json.timeEnded)
    );
  }
}
