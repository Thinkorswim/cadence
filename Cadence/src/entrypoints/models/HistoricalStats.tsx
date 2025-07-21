import { CompletedSession } from "./CompletedSession";

export class HistoricalStats {
  public stats: Record<string, CompletedSession[]>;

  constructor(stats: Record<string, CompletedSession[]> = {}) {
    this.stats = stats;
  }

  toJSON(): Record<string, ReturnType<CompletedSession["toJSON"]>[]> {
    const json: Record<string, ReturnType<CompletedSession["toJSON"]>[]> = {};
    for (const date in this.stats) {
      json[date] = this.stats[date].map(s => s.toJSON());
    }
    return json;
  }

  static fromJSON(json: Record<string, any[]>): HistoricalStats {
    const stats: Record<string, CompletedSession[]> = {};
    for (const date in json) {
      stats[date] = Array.isArray(json[date]) ? json[date].map(s => CompletedSession.fromJSON(s)) : [];
    }
    return new HistoricalStats(stats);
  }
}
