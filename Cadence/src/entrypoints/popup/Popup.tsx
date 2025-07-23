import { useState, useEffect } from 'react'
import './style.css';
import '~/assets/global.css';
import { Cog, ChartNoAxesColumn, Play, Pause, StopCircle, Square, FastForward } from 'lucide-react'
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"
import { cn, timeDisplayFormatBadge } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Session } from '../models/Session';
import { TimerState } from '../models/TimerState';
import { Settings } from '../models/Settings';
import { DailyStats } from '../models/DailyStats';

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

  const openStatisticsPage = () => {
    const url = browser.runtime.getURL('/options.html?section=statistics');
    browser.tabs.create({ url });
  }

  useEffect(() => {
    browser.storage.local.get(["session", "settings", "dailyStats"], (data) => {
      if (data.session) {
        const sessionData: Session = Session.fromJSON(data.session);
        setSession(sessionData);
        setTimerTime(sessionData.totalTime - sessionData.elapsedTime);
        setStartAngle(90);
        setEndAngle(90 + (360 * (sessionData.totalTime - sessionData.elapsedTime)) / sessionData.totalTime);
      }
      
      if (data.settings) {
        const settings: Settings = Settings.fromJSON(data.settings);
        setDailySessionsGoal(settings.dailySessionsGoal || 10);
      }
      
      if (data.dailyStats) {
        const dailyStats: DailyStats = DailyStats.fromJSON(data.dailyStats);
        setCompletedSessions(dailyStats.completedSessions ? dailyStats.completedSessions.length : 0);
      }
    });
  }, []);

  // wait for the background script to send the session data
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === "updateSession") {
        setSession(message.session);
        setTimerTime(message.session.totalTime - message.session.elapsedTime);
        setStartAngle(90);
        setEndAngle(90 + (360 * (message.session.totalTime - message.session.elapsedTime)) / message.session.totalTime);
        
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
        <div className='flex items-center justify-end'>
          <ChartNoAxesColumn className='w-5 h-5 text-primary cursor-pointer mr-2' onClick={openStatisticsPage} />
          <Cog className='w-5 h-5 text-primary cursor-pointer' onClick={() => browser.runtime.openOptionsPage()} />
        </div>
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
                        {timeDisplayFormatBadge(timerTime)}
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
        {session?.isStopped && session?.timerState === TimerState.Focus && (
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
        {!session?.isStopped && !session?.isPaused && (
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
        {session?.isPaused && session.timerState === TimerState.Focus && (
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

        {session?.isPaused && (session.timerState === TimerState.ShortBreak || session.timerState === TimerState.LongBreak) && (
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

        {(session?.timerState === TimerState.ShortBreak || session?.timerState === TimerState.LongBreak) && session?.isStopped && (
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
              <div key={rowIndex} className="flex gap-4 justify-center">
                {Array.from({ length: Math.min(5, dailySessionsGoal - rowIndex * 5) }, (_, colIndex) => {
                    const sessionIndex = rowIndex * 5 + colIndex;
                    const isCompleted = sessionIndex < completedSessions;
                    const isCurrentSession = sessionIndex === completedSessions && !session?.isStopped && session?.timerState === TimerState.Focus;
                    const isLastCompleted = sessionIndex === completedSessions - 1;
                    const isLastCircle = sessionIndex === dailySessionsGoal - 1;
                    
                    if (isCurrentSession) {
                      // Progressive circle fill for current focus session
                      const progress = session ? (session.elapsedTime / session.totalTime) : 0;
                      const progressPercentage = Math.max(5, Math.min(95, progress * 100)); // 5% to 95% range for visual offset
                      
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
