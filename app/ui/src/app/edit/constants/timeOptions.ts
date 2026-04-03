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
