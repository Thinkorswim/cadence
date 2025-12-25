import './style.css';
import '~/assets/global.css';
import { Button } from '@/components/ui/button'
import { useState, useEffect, useCallback } from 'react';
import { Dot, ChartNoAxesColumn, Info, Pencil, Clock, ChevronsUpDown, Check, Shield } from 'lucide-react'
import { Settings as SettingsIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RoundSlider, ISettingsPointer } from 'mz-react-round-slider';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatisticsChart } from './StatisticsChart';
import { Settings } from '../models/Settings';
import { BadgeDisplayFormat } from '../models/BadgeDisplayFormat';
import { BlockedWebsites } from '../models/BlockedWebsites';
import { BlockedWebsitesTable } from './BlockedWebsitesTable';
import { BlockedWebsiteForm } from './BlockedWebsiteForm';
import { Session } from '../models/Session';
import { CompletedSession } from '../models/CompletedSession';
import { TimerState } from '../models/TimerState';
import { DailyStats } from '../models/DailyStats';
import { HistoricalStats } from '../models/HistoricalStats';
import { ChartType } from '../models/ChartType';
import { ProjectsTable } from './ProjectsTable';
import { SessionsTable } from './SessionsTable';
import { ProjectUtils } from '@/lib/ProjectUtils';
import { cn, generateColorFromString } from '@/lib/utils';

function Options() {
  const [ctaProperty, setCtaProperty] = useState<string>('');
  const [ctaDiscordText, setCtaDiscordText] = useState<string>('');

  const selectCallToAction = () => {
    const randomProperty = Math.random() < 0.5 ? 'discord' : 'github';
    setCtaProperty(randomProperty);

    if (randomProperty === 'discord') {
      const ctaDiscordTexts: string[] = [
        'Have a question? Join the',
        'Need help? Join the',
        'Have a suggestion? Join the',
        'Want to chat? Join the',
        'Like productivity? Join the',
        'Have feedback? Join the',
      ];

      const randomIndex = Math.floor(Math.random() * ctaDiscordTexts.length);
      setCtaDiscordText(ctaDiscordTexts[randomIndex]);
    }
  };
  const [breakAutoStart, setBreakAutoStart] = useState(false);
  const [focusAutoStart, setFocusAutoStart] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.7);
  const [badgeDisplayFormat, setBadgeDisplayFormat] = useState<BadgeDisplayFormat>(BadgeDisplayFormat.Minutes);

  const [focusTime, setFocusTime] = useState(25 * 60);
  const [breakTime, setBreakTime] = useState(5 * 60);
  const [longBreakTime, setLongBreakTime] = useState(15 * 60);
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [longBreakEnabled, setLongBreakEnabled] = useState(false);
  const [dailySessionsGoal, setDailySessionsGoal] = useState(10);

  const [focusTimeDialogOpen, setFocusTimeDialogOpen] = useState(false);
  const [shortBreakDialogOpen, setShortBreakDialogOpen] = useState(false);
  const [longBreakTimeDialogOpen, setLongBreakTimeDialogOpen] = useState(false);
  const [longBreakIntervalDialogOpen, setLongBreakIntervalDialogOpen] = useState(false);
  const [dailySessionsGoalDialogOpen, setDailySessionsGoalDialogOpen] = useState(false);

  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');

  const [activeTab, setActiveTab] = useState<string>('settings');
  const [historicalStats, setHistoricalStats] = useState<HistoricalStats>(new HistoricalStats());
  const [chartType, setChartType] = useState<ChartType>(ChartType.Sessions);
  const [projects, setProjects] = useState<string[]>(['General']);
  const [selectedProject, setSelectedProject] = useState<string>('General');
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectError, setProjectError] = useState('');

  // Sessions management state
  const [editSessionDialogOpen, setEditSessionDialogOpen] = useState(false);
  const [addSessionDialogOpen, setAddSessionDialogOpen] = useState(false);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>('');
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number>(-1);
  const [editingSession, setEditingSession] = useState<CompletedSession | null>(null);
  const [sessionDuration, setSessionDuration] = useState(25 * 60);
  const [sessionDurationCircle, setSessionDurationCircle] = useState<ISettingsPointer[]>([
    {
      value: 25,
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }
  ]);

  // Input field values for datetime-local inputs (separate from editingSession)
  const [startTimeInput, setStartTimeInput] = useState<string>('');
  const [endTimeInput, setEndTimeInput] = useState<string>('');

  // Project selector state for dialog
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  // Blocked websites state
  const [blockedWebsites, setBlockedWebsites] = useState<BlockedWebsites>(new BlockedWebsites());
  const [tabsPermissionGranted, setTabsPermissionGranted] = useState<boolean>(false);
  const [isAddWebsiteDialogOpen, setIsAddWebsiteDialogOpen] = useState(false);

  // Helper function to safely convert Date to datetime-local string
  const toDateTimeLocalString = (date: Date): string => {
    try {
      if (!date || isNaN(date.getTime())) {
        return '';
      }
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch (error) {
      console.warn('Error converting date to datetime-local string:', error);
      return '';
    }
  };

  const [focusTimeCircle, setFocusTimeCircle] = useState<ISettingsPointer[]>([
    {
      value: Math.floor(focusTime / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }
  ]);

  const [breakTimeCircle, setBreakTimeCircle] = useState<ISettingsPointer[]>([
    {
      value: Math.floor(breakTime / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }
  ]);

  const [longBreakTimeCircle, setLongBreakTimeCircle] = useState<ISettingsPointer[]>([
    {
      value: Math.floor(longBreakTime / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }
  ]);

  useEffect(() => {
    // Select a random call to action on mount
    selectCallToAction();

    // Load settings from browser storage
    browser.storage.local.get(['settings', 'sessions'], (result) => {
      if (result.settings) {
        const settings = result.settings;
        setFocusAutoStart(settings.focusAutoStart);
        setBreakAutoStart(settings.breakAutoStart);
        setNotificationsEnabled(settings.notificationsEnabled ?? true);
        setSoundEnabled(settings.soundEnabled ?? false);
        setSoundVolume(settings.soundVolume ?? 0.7);
        setFocusTime(settings.focusTime);
        setBreakTime(settings.shortBreakTime);
        setLongBreakTime(settings.longBreakTime || 15 * 60);
        setLongBreakInterval(settings.longBreakInterval || 4);
        setLongBreakEnabled(settings.longBreakEnabled || false);
        setDailySessionsGoal(settings.dailySessionsGoal || 10);
        setChartType(settings.preferredChartType || ChartType.Sessions);
        setBadgeDisplayFormat(settings.badgeDisplayFormat || BadgeDisplayFormat.Minutes);
        setProjects(settings.projects || ['General']);
        setSelectedProject(settings.selectedProject || 'General');
      }
    });

  }, []);

  // Check permissions and load blocked websites
  useEffect(() => {
    // Check if tabs permission is already granted
    browser.permissions.contains({
      permissions: ['tabs']
    }).then((hasPermission) => {
      setTabsPermissionGranted(hasPermission);
      if (hasPermission) {
        loadBlockedWebsites();
      }
    });
  }, []);

  // Update break time circle when breakTime changes
  useEffect(() => {
    setBreakTimeCircle([{
      value: Math.floor(breakTime / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }]);
  }, [breakTime]);

  // Update long break time circle when longBreakTime changes
  useEffect(() => {
    setLongBreakTimeCircle([{
      value: Math.floor(longBreakTime / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }]);
  }, [longBreakTime]);

  // Update focus time circle when focusTime changes
  useEffect(() => {
    setFocusTimeCircle([{
      value: Math.floor(focusTime / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }]);
  }, [focusTime]);

  // Update session duration circle when sessionDuration changes
  useEffect(() => {
    setSessionDurationCircle([{
      value: Math.floor(sessionDuration / 60),
      radius: 12,
      bgColor: "#fff",
      bgColorSelected: '#eee',
    }]);
  }, [sessionDuration]);


  // Get the colors from CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const primary = getComputedStyle(root).getPropertyValue('--primary').trim().split(' ');
    setPrimaryColor("hsl(" + primary[0] + "," + primary[1] + "," + primary[2] + ")");

    const secondary = getComputedStyle(root).getPropertyValue('--secondary').trim().split(' ');
    setSecondaryColor(`hsla(${secondary[0]},${secondary[1]},${secondary[2]},0.2)`);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section && section == "statistics") {
      setActiveTab("statistics");
      handleStatisticsLoad();
    }
  }, []);


  const handleStatisticsLoad = () => {
    browser.storage.local.get(['dailyStats', 'historicalStats'], (data) => {
      const dailyStatistics: DailyStats = DailyStats.fromJSON(data.dailyStats) || new DailyStats();
      const historicalStatsObj: HistoricalStats = HistoricalStats.fromJSON(data.historicalStats);

      // Save completed sessions for the current date
      historicalStatsObj.stats[dailyStatistics.date] = dailyStatistics.completedSessions ? dailyStatistics.completedSessions : [];

      browser.storage.local.set({ historicalStats: historicalStatsObj.toJSON() });

      setHistoricalStats(historicalStatsObj);
    });
  }


  const handleSaveFocusTime = () => {
    browser.storage.local.get(['settings', 'session'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      const session: Session = Session.fromJSON(data.session) || new Session();

      settings.focusTime = focusTime;
      if (session.timerState === TimerState.Focus) {
        session.totalTime = focusTime;
      }

      browser.storage.local.set({ settings: settings.toJSON(), session: session.toJSON() }, () => {
        setFocusTimeDialogOpen(false);
      });
    });
  };

  const handleSaveBreakTime = () => {
    browser.storage.local.get(['settings', 'session'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      const session: Session = Session.fromJSON(data.session) || new Session();

      settings.shortBreakTime = breakTime;
      if (session.timerState === TimerState.ShortBreak) {
        session.totalTime = breakTime;
      }

      browser.storage.local.set({ settings: settings.toJSON(), session: session.toJSON() }, () => {
        setShortBreakDialogOpen(false);
      });
    });
  };


  const handleToggleAutoStartFocus = (checked: boolean) => {
    setFocusAutoStart(checked);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.focusAutoStart = checked;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }

  const handleToggleBreakAutoStart = (checked: boolean) => {
    setBreakAutoStart(checked);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.breakAutoStart = checked;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }

  const handleToggleNotifications = (checked: boolean) => {
    setNotificationsEnabled(checked);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.notificationsEnabled = checked;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }

  const handleToggleSound = (checked: boolean) => {
    setSoundEnabled(checked);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.soundEnabled = checked;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }

  const handleVolumeChange = (volume: number) => {
    setSoundVolume(volume);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.soundVolume = volume;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }

  const handleSaveLongBreakTime = () => {
    browser.storage.local.get(['settings', 'session'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      const session: Session = Session.fromJSON(data.session) || new Session();

      settings.longBreakTime = longBreakTime;
      if (session.timerState === TimerState.LongBreak) {
        session.totalTime = longBreakTime;
      }

      browser.storage.local.set({ settings: settings.toJSON(), session: session.toJSON() }, () => {
        setLongBreakTimeDialogOpen(false);
      });
    });
  };

  const handleSaveLongBreakInterval = () => {
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.longBreakInterval = longBreakInterval;
      browser.storage.local.set({ settings: settings.toJSON() }, () => {
        setLongBreakIntervalDialogOpen(false);
      });
    });
  };

  const handleToggleLongBreakEnabled = (checked: boolean) => {
    setLongBreakEnabled(checked);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.longBreakEnabled = checked;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  };

  const handleSaveDailySessionsGoal = (newGoal: number) => {
    setDailySessionsGoal(newGoal);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.dailySessionsGoal = newGoal;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }

  const handleBadgeDisplayFormatChange = (format: BadgeDisplayFormat) => {
    setBadgeDisplayFormat(format);
    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings) || {};
      settings.badgeDisplayFormat = format;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  }

  const handleBadgeDisplayFormatStringChange = (value: string) => {
    const format = value as BadgeDisplayFormat;
    handleBadgeDisplayFormatChange(format);
  }

  const addProject = () => {
    setAddProjectDialogOpen(true);
  };

  const handleAddProject = () => {
    const trimmedName = newProjectName.trim();

    if (!trimmedName) {
      setProjectError('Project name cannot be empty');
      return;
    }

    if (projects.includes(trimmedName)) {
      setProjectError('A project with this name already exists');
      return;
    }

    const updatedProjects = ProjectUtils.addProject(projects, trimmedName);
    setProjects(updatedProjects);

    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings);
      settings.projects = updatedProjects;
      browser.storage.local.set({ settings: settings.toJSON() });
    });

    setNewProjectName('');
    setProjectError('');
    setAddProjectDialogOpen(false);
  };

  const deleteProject = (projectDetails: { name: string }) => {
    const result = ProjectUtils.removeProject(projects, selectedProject, projectDetails.name);

    setProjects(result.projects);
    setSelectedProject(result.selectedProject);

    browser.storage.local.get(['settings'], (data) => {
      const settings: Settings = Settings.fromJSON(data.settings);
      settings.projects = result.projects;
      settings.selectedProject = result.selectedProject;
      browser.storage.local.set({ settings: settings.toJSON() });
    });
  };

  // Session management functions
  const handleDeleteSession = (date: string, sessionIndex: number) => {
    const updatedStats = { ...historicalStats.stats };
    const today = new Date().toLocaleDateString('en-CA').slice(0, 10);

    if (updatedStats[date]) {
      updatedStats[date] = updatedStats[date].filter((_, index) => index !== sessionIndex);
      if (updatedStats[date].length === 0) {
        delete updatedStats[date];
      }
    }

    const newHistoricalStats = new HistoricalStats(updatedStats);
    setHistoricalStats(newHistoricalStats);

    // If deleting from today, also update dailyStats
    if (date === today) {
      browser.storage.local.get(['dailyStats'], (data) => {
        const dailyStats = DailyStats.fromJSON(data.dailyStats || {
          date: today,
          completedSessions: []
        });

        // Update dailyStats with today's sessions from historicalStats
        dailyStats.date = today;
        dailyStats.completedSessions = updatedStats[today] || [];

        browser.storage.local.set({
          historicalStats: newHistoricalStats.toJSON(),
          dailyStats: dailyStats.toJSON()
        });
      });
    } else {
      browser.storage.local.set({ historicalStats: newHistoricalStats.toJSON() });
    }
  };

  const handleEditSession = (date: string, sessionIndex: number) => {
    const sessionsForDate = historicalStats.stats[date];
    if (sessionsForDate && sessionsForDate[sessionIndex]) {
      const sessionToEdit = sessionsForDate[sessionIndex];
      setEditingSession(new CompletedSession(
        sessionToEdit.totalTime,
        sessionToEdit.timeStarted,
        sessionToEdit.timeEnded,
        sessionToEdit.project
      ));
      setSessionDuration(sessionToEdit.totalTime);
      setStartTimeInput(toDateTimeLocalString(sessionToEdit.timeStarted));
      setEndTimeInput(toDateTimeLocalString(sessionToEdit.timeEnded));
      setSelectedSessionDate(date);
      setSelectedSessionIndex(sessionIndex);
      setEditSessionDialogOpen(true);
    }
  };

  const handleAddSession = () => {
    const now = new Date();
    const twentyFiveMinutesAgo = new Date(now.getTime() - 25 * 60 * 1000);

    const newSession = new CompletedSession(
      25 * 60, // Default 25 minutes
      twentyFiveMinutesAgo,
      now,
      selectedProject
    );

    setEditingSession(newSession);
    setSessionDuration(25 * 60);
    setStartTimeInput(toDateTimeLocalString(twentyFiveMinutesAgo));
    setEndTimeInput(toDateTimeLocalString(now));
    setSelectedSessionDate(''); // Empty indicates new session
    setSelectedSessionIndex(-1);
    setAddSessionDialogOpen(true);
  };

  const handleSaveSession = () => {
    if (!editingSession) return;

    // Create updated session with current duration
    const updatedSession = CompletedSession.fromJSON({
      totalTime: sessionDuration,
      timeStarted: startTimeInput,
      timeEnded: endTimeInput,
      project: editingSession.project
    })

    const updatedStats = { ...historicalStats.stats };
    const sessionDate = updatedSession.timeEnded.toLocaleDateString('en-CA').slice(0, 10); // Get YYYY-MM-DD format
    const today = new Date().toLocaleDateString('en-CA').slice(0, 10);

    if (selectedSessionDate === '') {
      // Adding new session
      if (!updatedStats[sessionDate]) {
        updatedStats[sessionDate] = [];
      }
      updatedStats[sessionDate].push(updatedSession);
    } else {
      // Editing existing session
      if (updatedStats[selectedSessionDate] && selectedSessionIndex >= 0) {
        if (selectedSessionDate !== sessionDate) {
          updatedStats[selectedSessionDate] = updatedStats[selectedSessionDate].filter((_, index) => index !== selectedSessionIndex);
          if (updatedStats[selectedSessionDate].length === 0) {
            delete updatedStats[selectedSessionDate];
          }
          if (!updatedStats[sessionDate]) {
            updatedStats[sessionDate] = [];
          }
          updatedStats[sessionDate].push(updatedSession);
        } else {
          updatedStats[selectedSessionDate][selectedSessionIndex] = updatedSession;
        }
      }
    }

    const newHistoricalStats = new HistoricalStats(updatedStats);
    setHistoricalStats(newHistoricalStats);

    // If the session is for today, also update dailyStats
    if (sessionDate === today) {
      browser.storage.local.get(['dailyStats'], (data) => {
        const dailyStats = DailyStats.fromJSON(data.dailyStats || {
          date: today,
          completedSessions: []
        });

        // Update dailyStats with today's sessions from historicalStats
        dailyStats.date = today;
        dailyStats.completedSessions = updatedStats[today] || [];

        browser.storage.local.set({
          historicalStats: newHistoricalStats.toJSON(),
          dailyStats: dailyStats.toJSON()
        });
      });
    } else {
      browser.storage.local.set({ historicalStats: newHistoricalStats.toJSON() });
    }

    setEditSessionDialogOpen(false);
    setAddSessionDialogOpen(false);
    setEditingSession(null);
    setSelectedSessionDate('');
    setSelectedSessionIndex(-1);
    setStartTimeInput('');
    setEndTimeInput('');
  };

  // Blocked websites functions
  const handleRequestTabsPermission = () => {
    browser.permissions.request({
      permissions: ['tabs']
    }).then((granted) => {
      if (granted) {
        setTabsPermissionGranted(true);
        loadBlockedWebsites();
      }
    });
  };

  const loadBlockedWebsites = () => {
    browser.storage.local.get(['blockedWebsites'], (data) => {
      if (data.blockedWebsites) {
        const websites = BlockedWebsites.fromJSON(data.blockedWebsites);
        setBlockedWebsites(websites);
      }
    });
  };

  const handleAddWebsite = () => {
    setIsAddWebsiteDialogOpen(true);
  };

  const handleDeleteWebsite = (websiteName: string) => {
    const updatedBlockedWebsites = new BlockedWebsites(
      new Set(blockedWebsites.websites),
      blockedWebsites.enabled
    );
    updatedBlockedWebsites.removeWebsite(websiteName);

    setBlockedWebsites(updatedBlockedWebsites);

    // Save to storage
    browser.storage.local.set({
      blockedWebsites: updatedBlockedWebsites.toJSON()
    });
  };

  const handleDialogClose = () => {
    setIsAddWebsiteDialogOpen(false);
    loadBlockedWebsites(); // Reload websites after dialog closes
  };

  const handleToggleWebsiteBlocking = (checked: boolean) => {
    if (checked && !tabsPermissionGranted) {
      // Request permission first when enabling
      browser.permissions.request({
        permissions: ['tabs']
      }).then((granted) => {
        if (granted) {
          setTabsPermissionGranted(true);
          const updatedBlockedWebsites = new BlockedWebsites(
            new Set(blockedWebsites.websites),
            true
          );
          setBlockedWebsites(updatedBlockedWebsites);
          browser.storage.local.set({
            blockedWebsites: updatedBlockedWebsites.toJSON()
          });
          loadBlockedWebsites();
        }
        // If permission denied, the switch will remain unchecked
      });
    } else {
      // Disabling or already have permission
      const updatedBlockedWebsites = new BlockedWebsites(
        new Set(blockedWebsites.websites),
        checked
      );

      setBlockedWebsites(updatedBlockedWebsites);

      // Save to storage
      browser.storage.local.set({
        blockedWebsites: updatedBlockedWebsites.toJSON()
      });
    }
  };



  return (
    <>
      <div className='px-10 flex flex-col min-h-screen max-w-screen-lg mx-auto font-geist'>
        <div className="flex-grow">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className='mt-8 mb-10 flex items-center'>
              <img src="/images/logo.svg" alt="Logo" className="w-10 h-10 mr-4" />

              <TabsList className='py-5 px-2'>
                <TabsTrigger className='data-[state=active]:shadow-none text-foreground' value="statistics" onClick={handleStatisticsLoad}><ChartNoAxesColumn className='w-5 h-5 mr-1' /> Statistics </TabsTrigger>
                <TabsTrigger className='data-[state=active]:shadow-none text-foreground' value="sessions" onClick={handleStatisticsLoad}><Clock className='w-5 h-5 mr-1' /> Sessions </TabsTrigger>
                <TabsTrigger className='data-[state=active]:shadow-none text-foreground' value="blocked-websites"><Shield className='w-5 h-5 mr-1' /> Blocked Sites</TabsTrigger>
                <TabsTrigger className='data-[state=active]:shadow-none text-foreground' value="settings" ><SettingsIcon className='w-5 h-5 mr-1' />  Settings</TabsTrigger>
              </TabsList>
            </div>

            {/* STATISTICS TAB */}
            <TabsContent value="statistics">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-primary'>
                  Statistics
                </div>
                <div className='mt-6 bg-muted p-5 rounded-xl'>
                  <StatisticsChart
                    historicalStats={historicalStats}
                    chartType={chartType}
                  />
                </div>
              </div>
            </TabsContent>


            {/* Sessions TAB */}
            <TabsContent value="sessions">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-primary'>
                  Sessions
                </div>
                <div className='mt-6 bg-muted p-5 rounded-xl'>
                  <SessionsTable
                    historicalStats={historicalStats}
                    deleteSession={handleDeleteSession}
                    editSession={handleEditSession}
                    addSession={handleAddSession}
                  />
                </div>
              </div>
            </TabsContent>

            {/* BLOCKED WEBSITES TAB */}
            <TabsContent value="blocked-websites">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-primary'>
                  Blocked Websites
                </div>
                <div className='mt-6 bg-muted p-5 rounded-xl'>
                  <div className={`flex items-center justify-between max-w-[300px]${blockedWebsites.enabled ? " mb-5" : ""}`}>
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="websiteBlockingEnabled">Website Blocking</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Enable blocking of websites during focus sessions.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="websiteBlockingEnabled"
                      className='data-[state=unchecked]:bg-white'
                      checked={blockedWebsites.enabled && tabsPermissionGranted}
                      onCheckedChange={handleToggleWebsiteBlocking}
                    />
                  </div>

                  {!tabsPermissionGranted && (
                    <div className="mt-5 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start">
                        <Info className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                        <div className="text-sm text-yellow-800">
                          <div className="font-medium mb-1">Permission Required</div>
                          <div className="leading-relaxed">
                            Website blocking requires tab access permission to detect when you visit blocked sites during focus sessions.
                            Your browser may show this as
                            <b>
                              {import.meta.env.BROWSER === 'firefox'
                                ? ' Access browser tabs'
                                : ' Read browsing history'
                              }
                            </b>. This permission is only used to check if the current tab matches your blocked websites list.
                            We never access, store or share your browsing history or any other data outside of this extension.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {blockedWebsites.enabled && (
                    <BlockedWebsitesTable
                      blockedWebsites={blockedWebsites.websites}
                      permissionGranted={tabsPermissionGranted}
                      onAddWebsite={handleAddWebsite}
                      onDeleteWebsite={handleDeleteWebsite}
                      onRequestPermission={handleRequestTabsPermission}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings">
              <div className='mt-10 mb-5'>
                <div className='text-3xl font-bold w-full text-primary'>
                  Settings
                </div>

                <div className='mt-6 bg-muted p-5 pt-3 rounded-xl'>
                  <ProjectsTable
                    projects={projects.map(name => ({ name }))}
                    selectedProject={selectedProject}
                    addProject={addProject}
                    deleteProject={deleteProject}
                  />
                </div>

                <div className='mt-3 bg-muted p-5 rounded-xl'>
                  <div className="flex items-center justify-between max-w-[300px]">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="autoStartFocus">Focus Time</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            The amount of time you want to focus before taking a break.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center text-base cursor-pointer" onClick={() => { setFocusTimeDialogOpen(true) }} >
                      <div>
                        {focusTime / 60} minutes
                      </div>
                      <Pencil className="ml-2 w-4 h-4 text-primary" />
                    </div>

                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="autoStartFocus">Break Time</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            The amount of time you want to take a break between focus sessions.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center text-base cursor-pointer" onClick={() => { setShortBreakDialogOpen(true) }}>
                      <div>
                        {breakTime / 60} minutes
                      </div>
                      <Pencil className="ml-2 w-4 h-4 text-primary" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="dailySessionsGoal">Daily Goal</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Set your target number of focus sessions to complete each day.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex items-center text-base cursor-pointer" onClick={() => { setDailySessionsGoalDialogOpen(true) }}>
                      <div>
                        {dailySessionsGoal} sessions
                      </div>
                      <Pencil className="ml-2 w-4 h-4 text-primary" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="longBreakEnabled">Long Breaks</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Enable longer breaks after completing several focus sessions.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="longBreakEnabled"
                      className='data-[state=unchecked]:bg-white'
                      checked={longBreakEnabled}
                      onCheckedChange={handleToggleLongBreakEnabled}
                    />
                  </div>

                  {longBreakEnabled && (
                    <>
                      <div className="flex items-center justify-between max-w-[300px] mt-5">
                        <div className="flex items-center">
                          <Label className='text-base' htmlFor="longBreakTime">Long Break Time</Label>
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <button className="flex items-center justify-center ml-2 rounded-full">
                                  <Info className="w-4 h-4 text-secondary" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-secondary text-white p-2 rounded">
                                The duration of your long break.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-center text-base cursor-pointer" onClick={() => { setLongBreakTimeDialogOpen(true) }}>
                          <div>
                            {longBreakTime / 60} minutes
                          </div>
                          <Pencil className="ml-2 w-4 h-4 text-primary" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between max-w-[300px] mt-5">
                        <div className="flex items-center">
                          <Label className='text-base' htmlFor="longBreakInterval">Long Break After</Label>
                          <TooltipProvider>
                            <Tooltip delayDuration={0}>
                              <TooltipTrigger asChild>
                                <button className="flex items-center justify-center ml-2 rounded-full">
                                  <Info className="w-4 h-4 text-secondary" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-secondary text-white p-2 rounded">
                                Take a long break after this many completed focus sessions.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-center text-base cursor-pointer" onClick={() => { setLongBreakIntervalDialogOpen(true) }}>
                          <div>
                            {longBreakInterval} sessions
                          </div>
                          <Pencil className="ml-2 w-4 h-4 text-primary" />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className='mt-3 bg-muted p-5 rounded-xl'>
                  <div className="flex items-center justify-between max-w-[300px]">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="focusAutoStart">Auto-start Focus Sessions</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Automatically start a focus session after a break.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="focusAutoStart"
                      className='data-[state=unchecked]:bg-white'
                      checked={focusAutoStart}
                      onCheckedChange={handleToggleAutoStartFocus}
                    />
                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="breakAutoStart">Auto-start Breaks</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Automatically start a break after a focus session.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="breakAutoStart"
                      className='data-[state=unchecked]:bg-white'
                      checked={breakAutoStart}
                      onCheckedChange={handleToggleBreakAutoStart}
                    />
                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="notificationsEnabled">Notifications</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Show desktop notifications when sessions complete.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="notificationsEnabled"
                      className='data-[state=unchecked]:bg-white'
                      checked={notificationsEnabled}
                      onCheckedChange={handleToggleNotifications}
                    />
                  </div>

                  <div className="flex items-center justify-between max-w-[300px] mt-5">
                    <div className="flex items-center">
                      <Label className='text-base' htmlFor="soundEnabled">Sound Notifications</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Play sound notifications when sessions complete.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      id="soundEnabled"
                      className='data-[state=unchecked]:bg-white'
                      checked={soundEnabled}
                      onCheckedChange={handleToggleSound}
                    />
                  </div>

                  {soundEnabled && (
                    <div className="max-w-[300px] mt-5">
                      <div className="flex items-center mb-3">
                        <Label className='text-base' htmlFor="soundVolume">Volume</Label>
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <button className="flex items-center justify-center ml-2 rounded-full">
                                <Info className="w-4 h-4 text-secondary" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-secondary text-white p-2 rounded">
                              Adjust the volume of sound notifications (0% - 100%).
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span className="ml-auto text-sm text-secondary">
                          {Math.round(soundVolume * 100)}%
                        </span>
                      </div>
                      <Slider
                        id="soundVolume"
                        value={[soundVolume]}
                        onValueChange={(value) => handleVolumeChange(value[0])}
                        max={1}
                        min={0}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                  )}

                  <div className="max-w-[300px] mt-8">
                    <div className="flex items-center mb-3">
                      <Label className='text-base'>Badge Display Format</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <button className="flex items-center justify-center ml-2 rounded-full">
                              <Info className="w-4 h-4 text-secondary" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-secondary text-white p-2 rounded">
                            Choose how time is displayed in the browser badge. Minutes format shows "25m" while seconds format shows "25:00".
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div 
                        className={`flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          badgeDisplayFormat === BadgeDisplayFormat.Minutes 
                            ? 'border-primary bg-primary/5' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleBadgeDisplayFormatChange(BadgeDisplayFormat.Minutes)}
                      >
                        {/* Minutes Preview */}
                        <div className="mb-3 flex flex-col items-center">
                          <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded min-w-[32px] text-center">
                            25m
                          </div>
                        </div>
                        <div className="flex items-center">
                          <RadioGroupItem 
                            value={BadgeDisplayFormat.Minutes}
                            checked={badgeDisplayFormat === BadgeDisplayFormat.Minutes}
                            onChange={() => handleBadgeDisplayFormatChange(BadgeDisplayFormat.Minutes)}
                            name="badgeDisplayFormat"
                          />
                          <Label htmlFor={BadgeDisplayFormat.Minutes} className="ml-2 cursor-pointer font-medium">
                            Minutes
                          </Label>
                        </div>
                      </div>

                      <div 
                        className={`flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          badgeDisplayFormat === BadgeDisplayFormat.Seconds 
                            ? 'border-primary bg-primary/5' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleBadgeDisplayFormatChange(BadgeDisplayFormat.Seconds)}
                      >
                        {/* Seconds Preview */}
                        <div className="mb-3 flex flex-col items-center">
                          <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded min-w-[32px] text-center">
                            25:00
                          </div>
                        </div>
                        <div className="flex items-center">
                          <RadioGroupItem 
                            value={BadgeDisplayFormat.Seconds}
                            checked={badgeDisplayFormat === BadgeDisplayFormat.Seconds}
                            onChange={() => handleBadgeDisplayFormatChange(BadgeDisplayFormat.Seconds)}
                            name="badgeDisplayFormat"
                          />
                          <Label htmlFor={BadgeDisplayFormat.Seconds} className="ml-2 cursor-pointer font-medium">
                            Seconds
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div >

        <Dialog open={focusTimeDialogOpen} onOpenChange={() => { setFocusTimeDialogOpen(false) }}>
          <DialogContent className="bg-background w-[370px]" >
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md '>
              <DialogTitle>Set Focus Time</DialogTitle>
              <DialogDescription>
                <div className="mb-5 mt-10 relative">
                  <div className='left-[17px] relative'>
                    <RoundSlider
                      pointers={focusTimeCircle}
                      onChange={(updated) => {
                        setFocusTime(updated[0].value as number * 60);

                      }}
                      pathStartAngle={270}
                      pathEndAngle={269.999}
                      hideText={true}
                      pathRadius={130}
                      pathThickness={12}
                      pathBgColor={secondaryColor}
                      connectionBgColor={primaryColor}
                      pointerBgColor={"#f48b85"}
                      pointerBgColorSelected={"#f48b85"}
                      min={0}
                      max={120}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: "42%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div>
                      <div className="flex items-center">
                        <label className="flex items-center">
                          <Input
                            className='w-16 no-arrows text-center md:text-base font-medium'
                            type="number"
                            style={{ MozAppearance: 'textfield' }}
                            value={focusTime / 60}
                            onChange={(e) => {
                              setFocusTime(Math.min(Number(e.target.value), 120) * 60);
                              setFocusTimeCircle([{
                                value: Math.min(Number(e.target.value), 120),
                              }]);
                            }}
                            min={0}
                            max={1200}
                            onFocus={(e) => e.target.select()}
                          />
                        </label>
                        <div className='mb-1 ml-2 text-lg'>minutes</div>
                      </div>

                    </div>
                  </div>
                </div>

                <div className='w-full text-right mb-2'>
                  <Button className="mt-5" onClick={() => { handleSaveFocusTime() }}> Save Focus Time </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={shortBreakDialogOpen} onOpenChange={() => { setShortBreakDialogOpen(false) }}>
          <DialogContent className="bg-background w-[370px]" >
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md '>
              <DialogTitle>Set Break Time</DialogTitle>
              <DialogDescription>
                <div className="mb-5 mt-10 relative">
                  <div className='left-[17px] relative'>
                    <RoundSlider
                      pointers={breakTimeCircle}
                      onChange={(updated) => {
                        setBreakTime(updated[0].value as number * 60);
                      }}
                      pathStartAngle={270}
                      pathEndAngle={269.999}
                      hideText={true}
                      pathRadius={130}
                      pathThickness={12}
                      pathBgColor={secondaryColor}
                      connectionBgColor={primaryColor}
                      pointerBgColor={"#f48b85"}
                      pointerBgColorSelected={"#f48b85"}
                      min={0}
                      max={60}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: "42%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div>
                      <div className="flex items-center">
                        <label className="flex items-center">
                          <Input
                            className='w-16 no-arrows text-center md:text-base font-medium'
                            type="number"
                            style={{ MozAppearance: 'textfield' }}
                            value={breakTime / 60}
                            onChange={(e) => {
                              setBreakTime(Math.min(Number(e.target.value), 60) * 60);
                              setBreakTimeCircle([{
                                value: Math.min(Number(e.target.value), 60),
                              }]);
                            }}
                            min={0}
                            max={60 * 60}
                            onFocus={(e) => e.target.select()}
                          />
                        </label>
                        <div className='mb-1 ml-2 text-lg'>minutes</div>
                      </div>

                    </div>
                  </div>
                </div>

                <div className='w-full text-right mb-2'>
                  <Button className="mt-5" onClick={() => { handleSaveBreakTime() }}> Save Break Time </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={longBreakTimeDialogOpen} onOpenChange={() => { setLongBreakTimeDialogOpen(false) }}>
          <DialogContent className="bg-background w-[370px]" >
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md '>
              <DialogTitle>Set Long Break Time</DialogTitle>
              <DialogDescription>
                <div className="mb-5 mt-10 relative">
                  <div className='left-[17px] relative'>
                    <RoundSlider
                      pointers={longBreakTimeCircle}
                      onChange={(updated) => {
                        setLongBreakTime(updated[0].value as number * 60);
                      }}
                      pathStartAngle={270}
                      pathEndAngle={269.999}
                      hideText={true}
                      pathRadius={130}
                      pathThickness={12}
                      pathBgColor={secondaryColor}
                      connectionBgColor={primaryColor}
                      pointerBgColor={"#f48b85"}
                      pointerBgColorSelected={"#f48b85"}
                      min={0}
                      max={60}
                    />
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: "42%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div>
                      <div className="flex items-center">
                        <label className="flex items-center">
                          <Input
                            className='w-16 no-arrows text-center md:text-base font-medium'
                            type="number"
                            style={{ MozAppearance: 'textfield' }}
                            value={longBreakTime / 60}
                            onChange={(e) => {
                              setLongBreakTime(Math.min(Number(e.target.value), 60) * 60);
                              setLongBreakTimeCircle([{
                                value: Math.min(Number(e.target.value), 60),
                              }]);
                            }}
                            min={0}
                            max={60}
                            onFocus={(e) => e.target.select()}
                          />
                        </label>
                        <div className='mb-1 ml-2 text-lg'>minutes</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='w-full text-right mb-2'>
                  <Button className="mt-5" onClick={() => { handleSaveLongBreakTime() }}> Save Long Break Time </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={longBreakIntervalDialogOpen} onOpenChange={() => { setLongBreakIntervalDialogOpen(false) }}>
          <DialogContent className="bg-background w-[370px]" >
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md '>
              <DialogTitle>Set Long Break Interval</DialogTitle>
              <DialogDescription>
                <div className="mb-5 mt-10 text-center">
                  <div className="flex items-center justify-center">
                    <label className="flex items-center">
                      <Input
                        className='w-20 no-arrows text-center md:text-base font-medium'
                        type="number"
                        style={{ MozAppearance: 'textfield' }}
                        value={longBreakInterval}
                        onChange={(e) => {
                          setLongBreakInterval(Math.max(1, Math.min(Number(e.target.value), 20)));
                        }}
                        min={1}
                        max={20}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <div className='mb-1 ml-2 text-lg'>sessions</div>
                  </div>
                </div>

                <div className='w-full text-right mb-2'>
                  <Button className="mt-5" onClick={() => { handleSaveLongBreakInterval() }}> Save Interval </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={dailySessionsGoalDialogOpen} onOpenChange={() => { setDailySessionsGoalDialogOpen(false) }}>
          <DialogContent className="bg-background w-[370px]" >
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md '>
              <DialogTitle>Set Daily Sessions Goal</DialogTitle>
              <DialogDescription>
                <div className="mb-5 mt-10 text-center">
                  <div className="flex items-center justify-center">
                    <label className="flex items-center">
                      <Input
                        className='w-20 no-arrows text-center md:text-base font-medium'
                        type="number"
                        style={{ MozAppearance: 'textfield' }}
                        value={dailySessionsGoal}
                        onChange={(e) => {
                          const newGoal = Math.max(1, Math.min(Number(e.target.value), 99));
                          setDailySessionsGoal(newGoal);
                        }}
                        min={1}
                        max={99}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <div className='mb-1 ml-2 text-lg'>sessions per day</div>
                  </div>
                </div>

                <div className='w-full text-right mb-2'>
                  <Button className="mt-5" onClick={() => {
                    handleSaveDailySessionsGoal(dailySessionsGoal);
                    setDailySessionsGoalDialogOpen(false);
                  }}> Save Goal </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={addProjectDialogOpen} onOpenChange={() => {
          setAddProjectDialogOpen(false);
          setNewProjectName('');
          setProjectError('');
        }}>
          <DialogContent className="bg-background w-[370px]" >
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md '>
              <DialogTitle>Add New Project</DialogTitle>
              <DialogDescription>
                <div className="mb-3 mt-6">
                  <Input
                    id="projectName"
                    className='mt-2'
                    type="text"
                    value={newProjectName}
                    onChange={(e) => {
                      setNewProjectName(e.target.value);
                      if (projectError) setProjectError('');
                    }}
                    placeholder="Enter project name..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddProject();
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                  />
                  {projectError && (
                    <div className="text-sm text-red-500 mt-2">{projectError}</div>
                  )}
                </div>

                <div className='w-full text-right mb-2'>
                  <Button
                    className="mt-5"
                    onClick={handleAddProject}
                    disabled={!newProjectName.trim()}
                  >
                    Add Project
                  </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Blocked Website Dialog */}
        <Dialog open={isAddWebsiteDialogOpen} onOpenChange={() => {
          setIsAddWebsiteDialogOpen(false);
        }}>
          <DialogContent className="bg-background w-[370px]">
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md'>
              <DialogTitle>Add Blocked Website</DialogTitle>
              <DialogDescription>
                <BlockedWebsiteForm callback={handleDialogClose} />
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>

        {/* Session Edit/Add Dialogs */}
        <Dialog open={editSessionDialogOpen || addSessionDialogOpen} onOpenChange={() => {
          setEditSessionDialogOpen(false);
          setAddSessionDialogOpen(false);
          setEditingSession(null);
          setSelectedSessionDate('');
          setSelectedSessionIndex(-1);
          setStartTimeInput('');
          setEndTimeInput('');
        }}>
          <DialogContent className="bg-background w-[400px]">
            <div className='bg-background m-2 pt-4 px-4 pb-2 rounded-md'>
              <DialogTitle>
                {selectedSessionDate === '' ? 'Add New Session' : 'Edit Session'}
              </DialogTitle>
              <DialogDescription>
                {editingSession && (
                  <div className="space-y-4 mt-6">
                    <div>
                      <Label htmlFor="sessionProject">Project</Label>
                      <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={projectSelectorOpen}
                            className="w-full mt-2 justify-between"
                          >
                            <div className="flex items-center">
                              <div
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: generateColorFromString(editingSession.project) }}
                              />
                              {editingSession.project}
                            </div>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0">
                          <Command className='bg-muted'>
                            {projects.length > 5 && (
                              <CommandInput placeholder="Search projects..." />
                            )}
                            <CommandList>
                              <CommandEmpty>No project found.</CommandEmpty>
                              <ScrollArea viewportClassName="max-h-[170px]">
                                <CommandGroup>
                                  {projects.map((project) => (
                                    <CommandItem
                                      key={project}
                                      value={project}
                                      onSelect={(currentValue) => {
                                        setEditingSession(new CompletedSession(
                                          editingSession.totalTime,
                                          editingSession.timeStarted,
                                          editingSession.timeEnded,
                                          project
                                        ));
                                        setProjectSelectorOpen(false);
                                      }}
                                      className="flex items-start gap-2 min-h-[36px] py-2"
                                    >
                                      <Check
                                        className={cn(
                                          "h-4 w-4 flex-shrink-0 mt-0.5",
                                          editingSession.project === project ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div
                                        className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                                        style={{ backgroundColor: generateColorFromString(project) }}
                                      />
                                      <span className="break-words leading-tight">{project}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </ScrollArea>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label htmlFor="totalTime">Duration</Label>
                      <div className="mb-5 mt-6 relative">
                        <div className='left-[38px] relative'>
                          <RoundSlider
                            pointers={sessionDurationCircle}
                            onChange={(updated) => {
                              setSessionDuration(updated[0].value as number * 60);
                            }}
                            pathStartAngle={270}
                            pathEndAngle={269.999}
                            hideText={true}
                            pathRadius={120}
                            pathThickness={12}
                            pathBgColor={secondaryColor}
                            connectionBgColor={primaryColor}
                            pointerBgColor={"#f48b85"}
                            pointerBgColorSelected={"#f48b85"}
                            min={0}
                            max={180}
                          />
                        </div>
                        <div
                          style={{
                            position: "absolute",
                            top: "42%",
                            left: "50%",
                            transform: "translateX(-50%)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div>
                            <div className="flex items-center">
                              <label className="flex items-center">
                                <Input
                                  className='w-16 no-arrows text-center md:text-base font-medium'
                                  type="number"
                                  style={{ MozAppearance: 'textfield' }}
                                  value={Math.floor(sessionDuration / 60)}
                                  onChange={(e) => {
                                    const newDuration = Math.min(Number(e.target.value), 180) * 60;
                                    setSessionDuration(newDuration);
                                  }}
                                  min={0}
                                  max={180}
                                  onFocus={(e) => e.target.select()}
                                />
                              </label>
                              <div className='mb-1 ml-2 text-lg'>minutes</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="startTime">Start Time</Label>
                        <Input
                          id="startTime"
                          type="datetime-local"
                          className="mt-2 [&::-webkit-calendar-picker-indicator]:opacity-100 w-[190px]"
                          value={startTimeInput}
                          onChange={(e) => {
                            setStartTimeInput(e.target.value);
                            const newStartTime = new Date(e.target.value);
                            if (!isNaN(newStartTime.getTime()) && editingSession) {
                              setEditingSession(new CompletedSession(
                                editingSession.totalTime,
                                newStartTime,
                                editingSession.timeEnded,
                                editingSession.project
                              ));
                            }
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endTime">End Time</Label>
                        <Input
                          id="endTime"
                          type="datetime-local"
                          className="mt-2 [&::-webkit-calendar-picker-indicator]:opacity-100 w-[190px]"
                          value={endTimeInput}
                          onChange={(e) => {
                            setEndTimeInput(e.target.value);

                            const newEndTime = new Date(e.target.value);
                            if (!isNaN(newEndTime.getTime()) && editingSession) {
                              setEditingSession(new CompletedSession(
                                editingSession.totalTime,
                                editingSession.timeStarted,
                                newEndTime,
                                editingSession.project
                              ));
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className='w-full text-right mb-2'>
                  <Button className="mt-5" onClick={handleSaveSession}>
                    {selectedSessionDate === '' ? 'Add Session' : 'Save Changes'}
                  </Button>
                </div>
              </DialogDescription>
            </div>
          </DialogContent>
        </Dialog>


        <footer className="bg-muted rounded-t-lg py-5 px-8 mt-10">
          <div className="container mx-auto flex justify-between items-center text-xs">
            <a href="https://groundedmomentum.com/" target="_blank" rel="noopener noreferrer" className="flex items-center text-secondary font-semibold transition-colors">
              <img src="/images/gm_logo_red.svg" alt="Grounded Momentum Logo" className="w-6 h-6 mr-2" /> Grounded Momentum <Dot className='w-2 h-2 mx-1' /> 2026
            </a>            
            {ctaProperty === 'discord' ? (
              <div className="flex items-center text-secondary font-semibold">
                {ctaDiscordText}
                <div className='flex items-center'>
                  <Button className="ml-3 rounded-lg" onClick={() => { window.open("https://discord.gg/SvTsqKwsgN", "_blank") }}>  <img height="20" width="20" className="mr-1 color-white" src="https://cdn.simpleicons.org/discord/ffffff" /> Discord </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center text-secondary font-semibold">
                Want to restrict distractions? Try
                <div className='flex items-center'>
                  <Button
                    className="ml-3 rounded-lg bg-background hover:bg-[#5c4523]/20 text-[#5c4523]"
                    onClick={() => {
                      let url = "https://chromewebstore.google.com/detail/time-snatch-block-website/epamlgdeklcjkldoaclgjdmjnchdgbho";
                      if (import.meta.env.BROWSER === "firefox") {
                        url = "https://addons.mozilla.org/en-US/firefox/addon/time-snatch-block-websites/";
                      } else if (import.meta.env.BROWSER === "edge") {
                        url = "https://microsoftedge.microsoft.com/addons/detail/time-snatch-block-websi/lpaajokgonohalagaibbjbnnelcdfckg";
                      }
                      window.open(url, "_blank");
                    }}
                  >
                    <img src="/images/logo-time-snatch.svg" alt="Logo" className="w-5 h-5" /> Time Snatch
                  </Button>
                </div>
              </div>
            )}
          </div>
        </footer>
      </div>
    </>
  )
}

export default Options;