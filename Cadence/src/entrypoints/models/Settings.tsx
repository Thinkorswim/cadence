import { ChartType } from './ChartType';

export class Settings {
  constructor(
    public focusTime: number = 25 * 60, // Default to 25 minutes in seconds
    public shortBreakTime: number = 5 * 60, // Default to 5 minutes in seconds
    public longBreakTime: number = 15 * 60, // TODO: Default to 15 minutes in seconds
    public longBreakInterval: number = 4, // TODO: Default to every 4 cycles
    public longBreakEnabled: boolean = true, // TODO: Default to long breaks enabled
    public breakAutoStart: boolean = true, // Default to auto-start breaks
    public focusAutoStart: boolean = false, // Default to not auto-start focus
    public dailySessionsGoal: number = 10, // Default to 10 sessions per day
    public preferredChartType: ChartType = ChartType.Sessions // Default to sessions chart
  ) {}

  toJSON(): { 
    focusTime: number; 
    shortBreakTime: number; 
    longBreakTime: number; 
    longBreakInterval: number; 
    longBreakEnabled: boolean; 
    breakAutoStart: boolean; 
    focusAutoStart: boolean;
    dailySessionsGoal: number;
    preferredChartType: ChartType;
   } {
    return {
        focusTime: this.focusTime,
        shortBreakTime: this.shortBreakTime,
        longBreakTime: this.longBreakTime,
        longBreakInterval: this.longBreakInterval,
        longBreakEnabled: this.longBreakEnabled,
        breakAutoStart: this.breakAutoStart,
        focusAutoStart: this.focusAutoStart,
        dailySessionsGoal: this.dailySessionsGoal,
        preferredChartType: this.preferredChartType,
    };
  }

  static fromJSON(json: {
    focusTime: number; 
    shortBreakTime: number; 
    longBreakTime: number; 
    longBreakInterval: number; 
    longBreakEnabled: boolean; 
    breakAutoStart: boolean; 
    focusAutoStart: boolean;
    dailySessionsGoal?: number;
    preferredChartType?: ChartType;
   }): Settings {
    return new Settings(
        json.focusTime,
        json.shortBreakTime,
        json.longBreakTime,
        json.longBreakInterval,
        json.longBreakEnabled,
        json.breakAutoStart,
        json.focusAutoStart,
        json.dailySessionsGoal ?? 10, // Default to 10 if goal not provided
        json.preferredChartType ?? ChartType.Sessions // Default to sessions if not provided
    );
  }
}
