export class CompletedSession {
  constructor(
    public totalTime: number,
    public timeStarted: Date,
    public timeEnded: Date,
    public project: string = "General"
  ) {}

  toJSON(): { totalTime: number; timeStarted: string; timeEnded: string; project: string } {
    return {
      totalTime: this.totalTime,
      timeStarted: this.timeStarted.toISOString(),
      timeEnded: this.timeEnded.toISOString(),
      project: this.project,
    };
  }

  static fromJSON(json: { totalTime: number; timeStarted: string; timeEnded: string; project?: string }): CompletedSession {
    return new CompletedSession(
      json.totalTime,
      new Date(json.timeStarted),
      new Date(json.timeEnded),
      json.project ?? "General"
    );
  }
}
