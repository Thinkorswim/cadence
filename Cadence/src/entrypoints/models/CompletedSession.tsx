export class CompletedSession {
  constructor(
    public totalTime: number,
    public timeStarted: Date,
    public timeEnded: Date
  ) {}

  toJSON(): { totalTime: number; timeStarted: Date; timeEnded: Date } {
    return {
      totalTime: this.totalTime,
      timeStarted: this.timeStarted,
      timeEnded: this.timeEnded,
    };
  }

  static fromJSON(json: { totalTime: number; timeStarted: Date; timeEnded: Date }): CompletedSession {
    return new CompletedSession(
      json.totalTime,
      json.timeStarted instanceof Date ? json.timeStarted : new Date(json.timeStarted),
      json.timeEnded instanceof Date ? json.timeEnded : new Date(json.timeEnded)
    );
  }
}
