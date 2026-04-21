// app/components/AddressGeocoder/utils/timeConversion.ts

/**
 * Time conversion utilities for delivery time windows.
 * Handles conversion between seconds-from-midnight and human-readable time formats.
 */

export const timeToSeconds = (time: string): number => {
  if (!time || time.trim() === '') return 0;
  
  const timeUpper = time.toUpperCase().trim();
  let hours = 0;
  let minutes = 0;
  
  if (timeUpper.includes('AM') || timeUpper.includes('PM')) {
    const isPM = timeUpper.includes('PM');
    const timePart = timeUpper.replace(/AM|PM/g, '').trim();
    const [h, m = 0] = timePart.split(':').map(s => parseInt(s.trim()) || 0);
    
    hours = h === 12 ? (isPM ? 12 : 0) : (isPM ? h + 12 : h);
    minutes = m;
  } else {
    const [h, m = 0] = time.split(':').map(s => parseInt(s.trim()) || 0);
    hours = h;
    minutes = m;
  }
  
  return hours * 3600 + minutes * 60;
};

export const secondsToTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const secondsToTimeAMPM = (seconds: number): string => {
  if (!seconds || seconds === 0) return '';
  
  const hours24 = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  
  const minutesStr = minutes.toString().padStart(2, '0');
  
  return `${hours12}:${minutesStr} ${period}`;
};

export const isValidTime = (timeStr: string): boolean => {
  if (!timeStr || timeStr.trim() === '') return true;
  
  const seconds = timeToSeconds(timeStr);
  const minSeconds = 7 * 3600; // 7 AM
  const maxSeconds = 21 * 3600; // 9 PM
  
  return seconds >= minSeconds && seconds <= maxSeconds;
};

export const isStartBeforeEnd = (startTime: string, endTime: string): boolean => {
  if (!startTime || !endTime) return true;
  
  const startSeconds = timeToSeconds(startTime);
  const endSeconds = timeToSeconds(endTime);
  
  return startSeconds < endSeconds;
};

export const validateTimeInput = (time: string): { valid: boolean; seconds: number } => {
  if (!time || time.trim() === '') {
    return { valid: true, seconds: 0 };
  }

  const seconds = timeToSeconds(time);
  const minSeconds = 7 * 3600;
  const maxSeconds = 21 * 3600;
  
  return {
    valid: seconds >= minSeconds && seconds <= maxSeconds,
    seconds: seconds
  };
};