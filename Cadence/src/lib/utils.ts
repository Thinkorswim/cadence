import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { BadgeDisplayFormat } from "@/entrypoints/models/BadgeDisplayFormat"

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


export const timeDisplayFormatBadge = (time: number, format: BadgeDisplayFormat = BadgeDisplayFormat.Minutes) => {
  const { hours, minutes, seconds } = convertSecondsToHoursMinutesSeconds(time)
  let timeString = ""

  // Always show seconds in the last minute (when remaining time is less than 60 seconds)
  const shouldShowSeconds = time < 60 || format === BadgeDisplayFormat.Seconds;

  if (hours > 0) {
    if (shouldShowSeconds) {
      timeString += `${hours}:` + `${minutes}`.padStart(2, '0') + ":" + `${seconds}`.padStart(2, '0')
    } else {
      timeString += `${hours}:` + `${minutes}`.padStart(2, '0')
    }
  } else {
    if (shouldShowSeconds) {
      timeString += `${minutes}` + ":" + `${seconds}`.padStart(2, '0')
    } else {
      timeString += `${minutes}m`
    }
  }

  return timeString
}

export const timeDisplayFormatPopup = (time: number) => {
  const { hours, minutes, seconds } = convertSecondsToHoursMinutesSeconds(time)
  let timeString = ""

  if (hours > 0) {
    timeString += `${hours}:` + `${minutes}`.padStart(2, '0') + ":" + `${seconds}`.padStart(2, '0')
  } else {
    timeString += `${minutes}` + ":" + `${seconds}`.padStart(2, '0')
  }

  return timeString
}

// Function to generate a consistent color from a string using HSL
export const generateColorFromString = (str: string): string => {
  if (str === 'General') {
    return 'hsl(3, 84%, 74%)';
  }
  
  // Create a simple hash from the string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate hue from hash (0-360 degrees)
  const hue = Math.abs(hash) % 360;
  
  // Use pastel-like colors with lower saturation and higher lightness
  const saturation = 45; 
  const lightness = 70;
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Extract hostname and domain from URL
export const extractHostnameAndDomain = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (error) {
    return null;
  }
};

// Validate if a string is a valid URL
export const validateURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

// Check if a URL matches a blocked pattern
export const isUrlBlocked = (url: string, blockedWebsites: string[]): boolean => {
  const hostname = extractHostnameAndDomain(url);
  if (!hostname) return false;

  return blockedWebsites.some(blockedSite => {
    // Exact match
    if (hostname === blockedSite) return true;
    
    // Subdomain match (e.g., www.example.com matches example.com)
    if (hostname.endsWith('.' + blockedSite)) return true;
    
    return false;
  });
};