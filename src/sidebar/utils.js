export async function openTab(props = {}) {
  const tabs = await browser.tabs.query({ windowId: browser.windows.WINDOW_ID_CURRENT });
  const activeTab = tabs.find(tab => tab.active);
  if (!props.index) {
    if (props._position === "afterCurrent") {
      props.index = activeTab.index + 1;
    } else {
      props.index = tabs.length;
    }
  }
  delete props._position;

  if (props["cookieStoreId"] === undefined) {
    props["cookieStoreId"] = "firefox-default";
  }

  props["openerTabId"] = activeTab.id;

  if (props["url"] === "about:newtab") {
    delete props["url"];
  }

  browser.tabs.create(props);
}

export function debounce(fn, delay) {
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

export function throttled(delay, fn) {
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
