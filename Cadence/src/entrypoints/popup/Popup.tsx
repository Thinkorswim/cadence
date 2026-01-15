import { useState, useEffect } from 'react'
import './style.css';
import '~/assets/global.css';
import { Cog, ChartNoAxesColumn, Play, Pause, StopCircle, Square, FastForward, ChevronsUpDown, Check, Plus, Sparkles } from 'lucide-react'
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { cn, timeDisplayFormatPopup, generateColorFromString } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { Session } from '@/models/Session';
import { SessionStatus } from '@/models/SessionStatus';
import { TimerState } from '@/models/TimerState';
import { Settings } from '@/models/Settings';
import { DailyStats } from '@/models/DailyStats';
import { HistoricalStats } from '@/models/HistoricalStats';
import { syncAll } from '@/lib/sync';

const chartConfig = {
  progress: {
    label: "Progress",
  },
  red: {
    label: "Red",
    color: "hsl(var(--primary))",
  },
  green: {
    label: "Green",
    color: "hsl(var(--green))",
  }
} satisfies ChartConfig

function Popup() {
  document.body.classList.add('w-[300px]')

  const [startAngle, setStartAngle] = useState(90)
  const [endAngle, setEndAngle] = useState(450)

  const [timerTime, setTimerTime] = useState(25 * 60)

  const [session, setSession] = useState<Session | null>(null)
  const [dailySessionsGoal, setDailySessionsGoal] = useState(10)
  const [completedSessions, setCompletedSessions] = useState(0)

  const [open, setOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState("General")
  const [projects, setProjects] = useState([
    { value: "General", label: "General" }
  ])
  const [isProUser, setIsProUser] = useState(false)

  const openStatisticsPage = () => {
    const url = browser.runtime.getURL('/options.html?section=statistics');
    browser.tabs.create({ url });
  }

  const updateSessionProject = (project: string) => {
    setSelectedProject(project);
    if (browser && browser.runtime && browser.runtime.sendMessage) {
      browser.runtime.sendMessage({ action: "updateSessionProject", project });
    }
    
    browser.storage.local.get(["settings"], (data) => {
      if (data.settings) {
        const settings = Settings.fromJSON(data.settings);
        settings.selectedProject = project;
        browser.storage.local.set({ settings: settings.toJSON() });
      }
    });
  }

  useEffect(() => {
    browser.storage.local.get(["session", "settings", "dailyStats", "user"], (data) => {
      // Set Pro user status and trigger sync
      if (data.user?.isPro) {
        setIsProUser(true);
        if (data.user?.authToken) {
          syncAll(data.user.authToken);
        }
      }
      
      if (data.session) {
        const sessionData: Session = Session.fromJSON(data.session);
        setSession(sessionData);
        const remainingTime = sessionData.getRemainingTime();
        setTimerTime(remainingTime);
        setStartAngle(90);
        setEndAngle(90 + (360 * remainingTime) / sessionData.getTotalTimeForCurrentState());
        setSelectedProject(sessionData.project || "General");
      }
      
      if (data.settings) {
        const settings: Settings = Settings.fromJSON(data.settings);
        setDailySessionsGoal(settings.dailySessionsGoal || 10);
        
        // Convert settings projects array to the format expected by the combobox
        const projectOptions = settings.projects.map(project => ({
          value: project,
          label: project
        }));
        setProjects(projectOptions);
        
        // Set selected project from settings if no session project is set
        if (!data.session?.project) {
          setSelectedProject(settings.selectedProject || "General");
        }
      }
      
      if (data.dailyStats) {
        const dailyStats: DailyStats = DailyStats.fromJSON(data.dailyStats);
        
        // Check if we need to move old daily stats to historical and reset for new day
        if (dailyStats.date !== new Date().toLocaleDateString('en-CA').slice(0, 10)) {
          browser.storage.local.get(["historicalStats"], (historicalData) => {
            const historicalStats = HistoricalStats.fromJSON(historicalData.historicalStats);
            historicalStats.stats[dailyStats.date] = dailyStats.completedSessions ? dailyStats.completedSessions : [];

            dailyStats.date = new Date().toLocaleDateString('en-CA').slice(0, 10);
            dailyStats.completedSessions = [];
            browser.storage.local.set({ historicalStats: historicalStats.toJSON(), dailyStats: dailyStats.toJSON() });
            setCompletedSessions(dailyStats.completedSessions ? dailyStats.completedSessions.length : 0);
          });
        } else {
            setCompletedSessions(dailyStats.completedSessions ? dailyStats.completedSessions.length : 0);
        }
      }
    });
  }, []);

  // Wait for the background script to send the session data
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === "updateSession") {
        // Reconstruct the Session instance to have access to methods
        const sessionData = Session.fromJSON(message.session);
        setSession(sessionData);
        const remainingTime = sessionData.getRemainingTime();
        setTimerTime(remainingTime);
        setStartAngle(90);
        setEndAngle(90 + (360 * remainingTime) / sessionData.getTotalTimeForCurrentState());
        setSelectedProject(sessionData.project || "General");
        
        // Update completed sessions count when session updates
        browser.storage.local.get(["dailyStats"], (data) => {
          if (data.dailyStats) {
            const dailyStats: DailyStats = DailyStats.fromJSON(data.dailyStats);
            setCompletedSessions(dailyStats.completedSessions ? dailyStats.completedSessions.length : 0);
          }
        });
      }
    }

    browser.runtime.onMessage.addListener(handleMessage);

    // Cleanup listener on unmount
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);

  const chartData = [
    { browser: "red", progress: 200, fill: session?.timerState === TimerState.ShortBreak || session?.timerState === TimerState.LongBreak ? "var(--color-green)" : "var(--color-red)" },
  ]

  return (
    <div className='w-full font-geist bg-background'>
      <div className='mb-5 py-3 flex items-center px-5 bg-muted rounded-b-2xl'>
        <div className='h-full w-full flex items-center justify-start '>
          <img src="/images/logo.svg" alt="Logo" className="w-5 h-5 mb-0.5" />
          <div className='text-primary ml-2 font-black text-lg'>
            Cadence
          </div>
        </div>
        {isProUser ? (
          <span
            onClick={() => {
              const url = browser.runtime.getURL('/options.html?section=gmplus');
              browser.tabs.create({ url });
            }}
            className="mr-2 cursor-pointer w-24 px-2 text-center bg-gradient-to-r from-chart-1 to-chart-2 py-0.5 text-xs  text-white border-primary/50 rounded-full font-semibold flex items-center justify-center transition-all duration-100 hover:scale-105"
          >
            <Sparkles className="inline-block w-3 h-3 mr-1" />
            Plus
          </span>
        ) : (
          <span
            onClick={() => {
              const url = browser.runtime.getURL('/options.html?section=gmplus');
              browser.tabs.create({ url });
            }}
            className="mr-2 cursor-pointer w-38 px-1.5 text-center bg-gradient-to-r from-chart-1 to-chart-2 py-0.5 text-xs  text-white border-primary/50 rounded-full font-semibold flex items-center justify-center transition-all duration-100 hover:scale-105"
          >
            <Sparkles className="inline-block w-3 h-3 mr-1" />
            Get Plus
          </span>
        )}
        <div className='flex items-center justify-end'>
          <ChartNoAxesColumn className='w-5 h-5 text-primary cursor-pointer mr-2' onClick={openStatisticsPage} />
          <Cog className='w-5 h-5 text-primary cursor-pointer' onClick={() => browser.runtime.openOptionsPage()} />
        </div>
      </div>

      {/* Project Selector */}
      <div className="flex justify-center my-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[250px] justify-between min-h-[40px] h-auto"
            >
              {selectedProject ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: generateColorFromString(selectedProject) }}
                  />
                  <span className="text-left truncate">
                    {projects.find((project) => project.value === selectedProject)?.label}
                  </span>
                </div>
              ) : (
                "Select project..."
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[250px] p-0">
            <Command className='bg-muted'>
              {projects.length > 5 && (
                <CommandInput placeholder="Search project..." />
              )}
              <CommandList>
                <CommandEmpty>No project found.</CommandEmpty>
                <ScrollArea  viewportClassName="max-h-[170px]">
                  <CommandGroup>
                    {projects.map((project) => (
                      <CommandItem
                        key={project.value}
                        value={project.value}
                        onSelect={(currentValue) => {
                          if (currentValue !== selectedProject) {
                            updateSessionProject(currentValue);
                          }
                          setOpen(false);
                        }}
                        className="flex items-start gap-2 min-h-[36px] py-2"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 flex-shrink-0 mt-0.5",
                            selectedProject === project.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: generateColorFromString(project.value) }}
                        />
                        <span className="break-words leading-tight">{project.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </ScrollArea>
                
                {/* Add Project Button */}
                <div className="border-t border-border p-1 ">
                  <Button
                    onClick={() => {
                      browser.runtime.openOptionsPage();
                      setOpen(false);
                    }}
                    className="w-full justify-start h-9 px-2 py-1.5 text-sm font-normal bg-muted hover:bg-secondary/10 text-foreground shadow-none"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Project
                  </Button>
                </div>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>


      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square max-w-[230px]"
      >
        <RadialBarChart
          data={chartData}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={95}
          outerRadius={125}
        >
          <PolarGrid
            gridType="circle"
            radialLines={false}
            stroke="none"
            className={
              session?.timerState === TimerState.ShortBreak
                ? "first:fill-green-300/20 last:fill-background"
                : "first:fill-secondary/20 last:fill-background"
            }

            polarRadius={[101, 89]}
          />
          <RadialBar dataKey="progress" background cornerRadius={10} />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 5}
                        className="fill-foreground text-4xl font-black"
                      >
                        {timeDisplayFormatPopup(timerTime)}
                      </tspan>
                    </text>
                  )
                }
              }}
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>

      <div className="flex justify-center pb-8 mt-4">
        {session?.status === SessionStatus.Stopped && session?.timerState === TimerState.Focus && (
          <Button
            className="w-36 py-5 text-lg font-semibold"
            onClick={() => {
              if (browser && browser.runtime && browser.runtime.sendMessage) {
                browser.runtime.sendMessage({ action: "startTimer" });
              }
            }}
          >
            <div className="flex items-center gap-2 mx-2">
              <Play className="h-4 w-4 fill-white text-white" />
              <div className='w-20'>
                Start
              </div>
            </div>
          </Button>
        )}
        {session?.status === SessionStatus.Running && (
          <Button
            className={cn(
              "w-36 py-5 text-lg font-semibold",
              session?.timerState === TimerState.ShortBreak || session?.timerState === TimerState.LongBreak
                ? "bg-green hover:bg-green/90 text-white"
                : ""
            )}
            onClick={() => {
              if (browser && browser.runtime && browser.runtime.sendMessage) {
                browser.runtime.sendMessage({ action: "pauseTimer" });
              }
            }}
          >
            <div className="flex items-center gap-2 ">
              <Pause className="h-4 w-4 fill-white text-white" />
              <div className='w-20'>
                Pause
              </div>
            </div>
          </Button>
        )}
        {session?.status === SessionStatus.Paused && session.timerState === TimerState.Focus && (
          <div className="flex flex-row items-center gap-2">
            <Button
              className="w-30 py-5 text-lg font-semibold"
              onClick={() => {
                if (browser && browser.runtime && browser.runtime.sendMessage) {
                  browser.runtime.sendMessage({ action: "resumeTimer" });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 fill-white text-white" />
                <div className='w-18'>
                  Resume
                </div>
              </div>
            </Button>

            <Button
              className="w-30 py-5 text-lg font-semibold"
              onClick={() => {
                if (browser && browser.runtime && browser.runtime.sendMessage) {
                  browser.runtime.sendMessage({ action: "stopTimer" });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Square className="h-4 w-4 fill-white text-white" />
                <div className='w-18'>
                  Stop
                </div>
              </div>
            </Button>
          </div>
        )}

        {session?.status === SessionStatus.Paused && (session.timerState === TimerState.ShortBreak || session.timerState === TimerState.LongBreak) && (
          <div className="flex flex-row items-center gap-2">
            <Button
              className="w-30 py-5 text-lg font-semibold bg-green hover:bg-green/90"
              onClick={() => {
                if (browser && browser.runtime && browser.runtime.sendMessage) {
                  browser.runtime.sendMessage({ action: "resumeTimer" });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 fill-white text-white" />
                <div className='w-18'>
                  Resume
                </div>
              </div>
            </Button>
            <Button
              className="w-30 py-5 text-lg font-semibold bg-green hover:bg-green/90"
              onClick={() => {
                if (browser && browser.runtime && browser.runtime.sendMessage) {
                  browser.runtime.sendMessage({ action: "skipBreak" });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <FastForward className="h-5 w-5 fill-white text-white" />
                <div className='w-18'>
                  Skip
                </div>
              </div>
            </Button>
          </div>
        )}

        {(session?.timerState === TimerState.ShortBreak || session?.timerState === TimerState.LongBreak) && session?.status === SessionStatus.Stopped && (
          <div className="flex flex-row items-center gap-2">
            <Button
              className="w-30 py-5 text-lg font-semibold bg-green hover:bg-green/90"
              onClick={() => {
                if (browser && browser.runtime && browser.runtime.sendMessage) {
                  browser.runtime.sendMessage({
                    action:
                      session?.timerState === TimerState.ShortBreak
                        ? "startShortBreak"
                        : "startLongBreak",
                  });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 fill-white text-white" />
                <div className='w-18'>
                  Start
                </div>
              </div>
            </Button>

            <Button
              className="w-30 py-5 text-lg font-semibold bg-green hover:bg-green/90"
              onClick={() => {
                if (browser && browser.runtime && browser.runtime.sendMessage) {
                  browser.runtime.sendMessage({ action: "skipBreak" });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <FastForward className="h-5 w-5 fill-white text-white" />
                <div className='w-18'>
                  Skip
                </div>
              </div>
            </Button>
          </div>
        )}
      </div>

      {/* Session Goal Visualization */}
      <div className="pb-6 px-4">
        <div className="flex flex-col gap-3 items-center">
          <div className="flex flex-col gap-2">
            {Array.from({ length: Math.ceil(dailySessionsGoal / 5) }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-5 justify-center">
                {Array.from({ length: Math.min(5, dailySessionsGoal - rowIndex * 5) }, (_, colIndex) => {
                    const sessionIndex = rowIndex * 5 + colIndex;
                    const isCompleted = sessionIndex < completedSessions;
                    const isCurrentSession = sessionIndex === completedSessions && session?.status === SessionStatus.Running && session?.timerState === TimerState.Focus;
                    const isLastCompleted = sessionIndex === completedSessions - 1;
                    const isLastCircle = sessionIndex === dailySessionsGoal - 1;
                    
                    if (isCurrentSession) {
                      // Progressive circle fill for current focus session
                      const progress = session ? (session.getElapsedTime() / session.getTotalTimeForCurrentState()) : 0;
                      const progressPercentage = Math.max(5, Math.min(95, progress * 100)); 
                      
                      return (
                        <div
                          key={sessionIndex}
                          className="w-8 h-8 rounded-full border-1 border-primary relative overflow-hidden"
                          style={{
                            background: `linear-gradient(to right, hsl(var(--primary)) ${progressPercentage}%, hsl(var(--background)) ${progressPercentage}%)`
                          }}
                        />
                      );
                    }
                    
                    return (
                      <div
                        key={sessionIndex}
                        className={cn(
                          "w-8 h-8 rounded-full border-1 border-primary flex items-center justify-center",
                          isCompleted ? "bg-primary" : "bg-background"
                        )}
                      >
                        {((isLastCompleted && completedSessions > 0 && completedSessions <= dailySessionsGoal) || 
                          (isLastCircle && completedSessions > dailySessionsGoal) ||
                          (sessionIndex === 0 && completedSessions === 0)) && (
                          <span className={cn(
                            "text-lg font-light",
                            completedSessions === 0 ? "text-primary" : "text-background"
                          )}>
                            {completedSessions === 0 ? "0" : completedSessions}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
        </div>
      </div>
    </div>
  )
}

export default Popup;
