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
  return function(...args) {
    const now = new Date().getTime();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return fn(...args);
  };
}

export function extractNew(changes) {
  let values = {};
  for (let [key, change] of Object.entries(changes)) {
    values[key] = change.newValue;
  }
  return values;
}
