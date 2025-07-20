import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function convertSecondsToHoursMinutesSeconds(seconds: number): { hours: number; minutes: number; seconds: number } {
  if (seconds < 0) return { hours: 0, minutes: 0, seconds: 0 };

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return { hours, minutes, seconds: remainingSeconds };
}


export const timeDisplayFormatBadge = (time: number) => {
  const { hours, minutes, seconds } = convertSecondsToHoursMinutesSeconds(time)
  let timeString = ""

  if (hours > 0) {
    timeString += `${hours}:` + `${minutes}`.padStart(2, '0')
  } else {
    timeString += `${minutes}` + ":" + `${seconds}`.padStart(2, '0')
  }

  return timeString
}