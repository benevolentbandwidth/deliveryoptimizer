/** 12-hour clock labels in 15-minute steps (e.g. "1:00 AM") for time-of-day pickers. */
export const TIME_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const minStr = m.toString().padStart(2, "0");
      options.push(`${hour12}:${minStr} ${ampm}`);
    }
  }
  return options;
})();

/** Fixed choices for how long before delivery the driver may arrive. */
export const TIME_BUFFER_OPTIONS = ["5 min", "10 min", "30 min", "45 min", "1hr", "2hr", "3hr", "4hr", "5hr", "6hr", "7hr", "8hr"];

/** One-hour windows spanning the day (e.g. "1am - 2am") for "delivery between" fields. */
export const DELIVERY_BETWEEN_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    const startHour = h % 12 || 12;
    const startAmpm = h < 12 ? "am" : "pm";
    const endH = (h + 1) % 24;
    const endHour = endH % 12 || 12;
    const endAmpm = endH < 12 ? "am" : "pm";
    options.push(`${startHour}${startAmpm} - ${endHour}${endAmpm}`);
  }
  return options;
})();

/** Fixed choices for how long before delivery the driver may arrive. */
export const TIME_BUFFER_OPTIONS = ["5 min", "10 min", "30 min", "45 min", "1hr", "2hr", "3hr", "4hr", "5hr", "6hr", "7hr", "8hr"];

/** One-hour windows spanning the day (e.g. "1am - 2am") for "delivery between" fields. */
export const DELIVERY_BETWEEN_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    const startHour = h % 12 || 12;
    const startAmpm = h < 12 ? "am" : "pm";
    const endH = (h + 1) % 24;
    const endHour = endH % 12 || 12;
    const endAmpm = endH < 12 ? "am" : "pm";
    options.push(`${startHour}${startAmpm} - ${endHour}${endAmpm}`);
  }
  return options;
})();
