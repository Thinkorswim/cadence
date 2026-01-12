import { ChartType } from './ChartType';
import { BadgeDisplayFormat } from './BadgeDisplayFormat';

export class Settings {
  constructor(
    public focusTime: number = 25 * 60, // Default to 25 minutes in seconds
    public shortBreakTime: number = 5 * 60, // Default to 5 minutes in seconds
    public longBreakTime: number = 15 * 60, // TODO: Default to 15 minutes in seconds
    public longBreakInterval: number = 4, // TODO: Default to every 4 cycles
    public longBreakEnabled: boolean = false, // Default to long breaks disabled
    public breakAutoStart: boolean = true, // Default to auto-start breaks
    public focusAutoStart: boolean = false, // Default to not auto-start focus
    public notificationsEnabled: boolean = true, // Default to notifications enabled
    public soundEnabled: boolean = true, // Default to sound enabled
    public soundVolume: number = 0.7, // Default to 70% volume
    public dailySessionsGoal: number = 10, // Default to 10 sessions per day
    public preferredChartType: ChartType = ChartType.Sessions, // Default to sessions chart
    public badgeDisplayFormat: BadgeDisplayFormat = BadgeDisplayFormat.Minutes, // Default to minutes format
    public projects: string[] = ['General'], // Default to General project
    public selectedProject: string = 'General' // Default to General project
  ) {}

  toJSON(): { 
    focusTime: number; 
    shortBreakTime: number; 
    longBreakTime: number; 
    longBreakInterval: number; 
    longBreakEnabled: boolean; 
    breakAutoStart: boolean; 
    focusAutoStart: boolean;
    notificationsEnabled: boolean;
    soundEnabled: boolean;
    soundVolume: number;
    dailySessionsGoal: number;
    preferredChartType: ChartType;
    badgeDisplayFormat: BadgeDisplayFormat;
    projects: string[];
    selectedProject: string;
   } {
    return {
        focusTime: this.focusTime,
        shortBreakTime: this.shortBreakTime,
        longBreakTime: this.longBreakTime,
        longBreakInterval: this.longBreakInterval,
        longBreakEnabled: this.longBreakEnabled,
        breakAutoStart: this.breakAutoStart,
        focusAutoStart: this.focusAutoStart,
        notificationsEnabled: this.notificationsEnabled,
        soundEnabled: this.soundEnabled,
        soundVolume: this.soundVolume,
        dailySessionsGoal: this.dailySessionsGoal,
        preferredChartType: this.preferredChartType,
        badgeDisplayFormat: this.badgeDisplayFormat,
        projects: this.projects,
        selectedProject: this.selectedProject,
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
    notificationsEnabled?: boolean;
    soundEnabled?: boolean;
    soundVolume?: number;
    dailySessionsGoal?: number;
    preferredChartType?: ChartType;
    badgeDisplayFormat?: BadgeDisplayFormat;
    projects?: string[];
    selectedProject?: string;
   }): Settings {
    const projects = json.projects ?? ['General'];
    
    return new Settings(
        json.focusTime,
        json.shortBreakTime,
        json.longBreakTime,
        json.longBreakInterval,
        json.longBreakEnabled,
        json.breakAutoStart,
        json.focusAutoStart,
        json.notificationsEnabled ?? true, // Default to notifications enabled
        json.soundEnabled ?? false, // Default to sound disabled
        json.soundVolume ?? 0.7, // Default to 70% volume
        json.dailySessionsGoal ?? 10, // Default to 10 if goal not provided
        json.preferredChartType ?? ChartType.Sessions, // Default to sessions if not provided
        json.badgeDisplayFormat ?? BadgeDisplayFormat.Minutes, // Default to minutes format
        projects,
        json.selectedProject ?? (projects.length > 0 ? projects[0] : 'General') // Default to first project or General
    );
  }
}
