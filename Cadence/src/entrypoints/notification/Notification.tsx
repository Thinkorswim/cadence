import '~/assets/global.css';
import { CheckCircle2, Coffee, Clock } from 'lucide-react';
import { generateColorFromString } from '@/lib/utils';

// Parse URL params synchronously — available on first render
const searchParams = new URLSearchParams(window.location.search);
const notifType = searchParams.get('type') as 'focus-complete' | 'break-ended' | null;
const rawDuration = searchParams.get('duration');
const rawBreakDuration = searchParams.get('breakDuration');
const durationSeconds = rawDuration ? Number(rawDuration) : null;
const breakDurationSeconds = rawBreakDuration ? Number(rawBreakDuration) : null;
const project = searchParams.get('project') || '';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

const isFocus = notifType === 'focus-complete';
const isBreak = notifType === 'break-ended';

function Notification() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full mx-auto text-center mb-18">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-14">
          <img src="/images/logo.svg" alt="Cadence Logo" className="w-7 h-7" />
          <span className="text-lg font-semibold text-muted-foreground">Cadence</span>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-7">
          {isFocus && (
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'hsl(var(--green) / 0.12)' }}
            >
              <CheckCircle2
                className="w-16 h-16"
                style={{ color: 'hsl(var(--green))' }}
              />
            </div>
          )}
          {isBreak && (
            <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center">
              <Coffee className="w-16 h-16 text-primary" />
            </div>
          )}
        </div>

        {/* Heading */}
        {isFocus && (
          <>
            <h1
              className="text-5xl font-bold mb-3"
              style={{ color: 'hsl(var(--green))' }}
            >
              Session Complete
            </h1>
            <p className="text-xl text-muted-foreground">Time for a well-earned break</p>
          </>
        )}
        {isBreak && (
          <>
            <h1 className="text-5xl font-bold text-primary mb-3">
              Break Over
            </h1>
            <p className="text-xl text-muted-foreground">Time to focus again</p>
          </>
        )}

        {/* Details row — focus: session duration + upcoming break + project */}
        {isFocus && (durationSeconds !== null || breakDurationSeconds !== null || project) && (
          <div className="flex items-center justify-center gap-8 mt-10 pt-8 border-t border-border">
            {durationSeconds !== null && (
              <div className="flex flex-col items-center gap-1">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-2xl font-semibold text-foreground">
                  {formatDuration(durationSeconds)}
                </span>
                <span className="text-sm text-muted-foreground">session</span>
              </div>
            )}
            {breakDurationSeconds !== null && (
              <div className="flex flex-col items-center gap-1">
                <Coffee className="w-5 h-5 text-muted-foreground" />
                <span className="text-2xl font-semibold text-foreground">
                  {formatDuration(breakDurationSeconds)}
                </span>
                <span className="text-sm text-muted-foreground">next break</span>
              </div>
            )}
            {project && (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: generateColorFromString(project) }}
                />
                <span className="text-2xl font-semibold text-foreground">{project}</span>
                <span className="text-sm text-muted-foreground">project</span>
              </div>
            )}
          </div>
        )}

        {/* Details row — break: duration only */}
        {isBreak && durationSeconds !== null && (
          <div className="flex items-center justify-center mt-10 pt-8 border-t border-border">
            <div className="flex flex-col items-center gap-1">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="text-2xl font-semibold text-foreground">
                {formatDuration(durationSeconds)}
              </span>
              <span className="text-sm text-muted-foreground">break</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Notification;
