export const COMPACT_MODE = {
  OFF: 0,
  DYNAMIC: 1,
  STRICT: 2,
};

export const SWITCH_BY_SCROLLING = {
  WITH_CTRL: 0,
  ALWAYS: 1,
  NEVER: 2,
};

export const DEFAULT_PREFS = {
  animations: true,
  themeIntegration: true,
  compactMode: COMPACT_MODE.STRICT,
  compactPins: true,
  switchLastActiveTab: false,
  switchByScrolling: SWITCH_BY_SCROLLING.WITH_CTRL,
  notifyClosingManyTabs: true,
  useCustomCSS: true,
  customCSS: "",
};

export function debounced(fn, delay) {
  let timeoutID;
  return (...args) => {
    if (timeoutID) {
      clearTimeout(timeoutID);
    }
    timeoutID = setTimeout(() => {
      timeoutID = null;
      fn(...args);
    }, delay);
  };
}

export function throttled(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = new Date().getTime();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return fn(...args);
  };
}

export function extractNew(changes) {
  const values = {};
  for (const [key, change] of Object.entries(changes)) {
    values[key] = change.newValue;
  }
  return values;
}

export function svgToDataUrl(svg, color) {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace("context-fill", color))}`;
}
