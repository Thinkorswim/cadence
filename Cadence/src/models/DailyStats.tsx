
import { CompletedSession } from "./CompletedSession";

export class DailyStats {
  public date: string;
  public completedSessions: CompletedSession[];

  constructor(
    date: string = new Date().toLocaleDateString('en-CA').slice(0, 10),
    completedSessions: CompletedSession[] = []
  ) {
    this.date = date;
    this.completedSessions = completedSessions;
  }

  toJSON(): { date: string; completedSessions: ReturnType<CompletedSession["toJSON"]>[] } {
    return {
      date: this.date,
      completedSessions: this.completedSessions.map((s) => s.toJSON()),
    };
  }

  static fromJSON(json: { date: string; completedSessions: any[] }): DailyStats {
    return new DailyStats(
      json.date,
      json.completedSessions.map((s) => CompletedSession.fromJSON(s))
    );
  }
}