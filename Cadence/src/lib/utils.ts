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

// Function to generate a consistent color from a string using HSL
export const generateColorFromString = (str: string): string => {
  // Special case for "General" project - use secondary color from CSS variables
  if (str === 'General') {
    return 'hsl(3, 84%, 74%)'; // --secondary: 3 84% 74%
  }
  
  // Create a simple hash from the string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate hue from hash (0-360 degrees)
  const hue = Math.abs(hash) % 360;
  
  // Use pastel-like colors with lower saturation and higher lightness
  const saturation = 45; // Lower saturation for softer, pastel colors
  const lightness = 70;  // Higher lightness for a more pastel appearance
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};