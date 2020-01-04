import Sidetab from "../sidetab.js";

const jsdom = require("jsdom");
const fs = require("fs");

const html = fs.readFileSync(`${__dirname}/../sidebar.html`).toString();
const browser = {
  contextualIdentities: {
    get: jest.fn(_cookieStoreId => new Promise(resolve => resolve({ color: "blue" }))),
  },
  i18n: {
    getMessage: jest.fn(key => `Translated<${key}>`),
  },
};
Object.defineProperty(global, "browser", { value: browser });

beforeEach(() => {
  const { window } = new jsdom.JSDOM(html);
  Object.defineProperty(global, "window", { value: window });
  Object.defineProperty(global, "document", { value: window.document });
});

test("template is correctly filled once during creation of the first sidetab", () => {
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
  });
  expect(sidetab.view.querySelector(".tab-close").title).toBe("Translated<closeTabButtonTooltip>");
  expect(sidetab.view.querySelector(".tab-icon-overlay-audible").title).toBe(
    "Translated<unmuteTabButtonTooltip>",
  );
  expect(sidetab.view.querySelector(".tab-icon-overlay-muted").title).toBe(
    "Translated<muteTabButtonTooltip>",
  );

  Object.defineProperty(global, "document", { value: null });
  const sidetab2 = new Sidetab({
    id: 2,
    index: 2,
  });
});

test("sidetab correctly displays host", () => {
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
    url: "https://example.com",
  });
  expect(sidetab.view.querySelector(".tab-url").innerText).toBe("example.com");

  sidetab.update({ url: "http://example.com:8080/test" });
  expect(sidetab.view.querySelector(".tab-url").innerText).toBe("example.com:8080/test");

  sidetab.update({ url: "about:config" });
  expect(sidetab.view.querySelector(".tab-url").innerText).toBe("about:config");

  sidetab.update({ url: "chrome://browser/skin/privatebrowsing/favicon.svg" });
  expect(sidetab.view.querySelector(".tab-url").innerText).toBe(
    "chrome://browser/skin/privatebrowsing/favicon.svg",
  );

  sidetab.update({ url: "file:///home/user" });
  expect(sidetab.view.querySelector(".tab-url").innerText).toBe("file:///home/user");

  sidetab.update({ url: "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D" });
  expect(sidetab.view.querySelector(".tab-url").innerText).toBe(
    "data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D",
  );
});

test("sidetab is marked correctly if tab is in a container", () => {
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
    cookieStoreId: "firefox-container-1",
  });
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(expect(sidetab.view.getAttribute("data-identity-color")).toBe("blue"));
    }, 20);
  });
});

test("sidetab updates correctly its appearance depending on its values", () => {
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
  });
  sidetab.updateActive(true);
  expect(sidetab.view.classList.contains("active")).toBe(true);
  sidetab.updateActive(false);
  expect(sidetab.view.classList.contains("active")).toBe(false);

  sidetab.update({ attention: true });
  expect(sidetab.view.classList.contains("wants-attention")).toBe(true);
  sidetab.update({ attention: false });
  expect(sidetab.view.classList.contains("wants-attention")).toBe(false);

  sidetab.update({ discarded: true });
  expect(sidetab.view.classList.contains("discarded")).toBe(true);
  sidetab.update({ discarded: false });
  expect(sidetab.view.classList.contains("discarded")).toBe(false);

  sidetab.update({ audible: true });
  expect(sidetab.view.classList.contains("audible")).toBe(true);
  sidetab.update({ audible: false });
  expect(sidetab.view.classList.contains("audible")).toBe(false);

  sidetab.update({ mutedInfo: { muted: true } });
  expect(sidetab.view.classList.contains("muted")).toBe(true);
  sidetab.update({ mutedInfo: { muted: false } });
  expect(sidetab.view.classList.contains("muted")).toBe(false);

  sidetab.update({ status: "loading" });
  expect(sidetab.view.classList.contains("loading")).toBe(true);
  sidetab.update({ status: "complete" });
  expect(sidetab.view.classList.contains("loading")).toBe(false);
});

test("sidetab is marked as .wants-attention if its title changed when not active", () => {
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
    title: "Test",
  });
  expect(sidetab.view.classList.contains("wants-attention")).toBe(false);

  sidetab.updateActive(true);
  expect(sidetab.view.classList.contains("wants-attention")).toBe(false);

  sidetab.update({ title: "New test" });
  expect(sidetab.view.classList.contains("wants-attention")).toBe(false);

  sidetab.updateActive(true);
  sidetab.update({ title: "New test" });
  expect(sidetab.view.classList.contains("wants-attention")).toBe(false);
});

test("sidetab is marked as .unread if it hasn’t been active since last page loading", () => {
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
    active: false,
  });
  sidetab.update({ status: "loading" });
  sidetab.update({ status: "complete" });
  expect(sidetab.view.classList.contains("unread")).toBe(true);

  sidetab.updateActive({ active: true });
  expect(sidetab.view.classList.contains("unread")).toBe(false);
});

test("sidetab handles correctly Firefox favicons", () => {
  let sidetab = new Sidetab({
    id: 1,
    index: 1,
  });
  let iconView = sidetab.view.querySelector(".tab-icon");
  expect(iconView.style.backgroundImage).toBe(`url(img/default-favicon.svg)`);
  expect(iconView.classList.contains("chrome-icon")).toBe(true);

  sidetab.update({ favIconUrl: "chrome://browser/skin/developer.svg" });
  expect(iconView.classList.contains("chrome-icon")).toBe(true);

  sidetab = new Sidetab({
    id: 1,
    index: 1,
    favIconUrl: "",
  });
  iconView = sidetab.view.querySelector(".tab-icon");
  expect(iconView.style.backgroundImage).toBe(`url(img/default-favicon.svg)`);
  expect(iconView.classList.contains("chrome-icon")).toBe(true);

  sidetab.update({ favIconUrl: "chrome://browser/skin/privatebrowsing/favicon.svg" });
  expect(iconView.classList.contains("chrome-icon")).toBe(false);

  // https://bugzilla.mozilla.org/show_bug.cgi?id=1462948
  sidetab.update({ favIconUrl: "chrome://mozapps/skin/extensions/extensionGeneric-16.svg" });
  expect(iconView.style.backgroundImage).toBe(`url(img/extensions.svg)`);
  expect(iconView.classList.contains("chrome-icon")).toBe(true);
});

test("sidetab handles correctly highlighting title and URL", () => {
  const originalTitle = "Test";
  const originalUrl = "https://example.com";
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
    title: originalTitle,
    url: originalUrl,
  });
  const titleView = sidetab.view.querySelector(".tab-title");
  const urlView = sidetab.view.querySelector(".tab-url");

  const newTitle = "T<b>e</b>st";
  sidetab.highlightTitle(newTitle);
  expect(titleView.innerHTML).toBe(newTitle);

  const newHost = "<b>e</b>xample.com";
  sidetab.highlightHost(newHost);
  expect(urlView.innerHTML).toBe(newHost);

  sidetab.resetHighlights();
  expect(titleView.textContent).toBe(originalTitle);
  expect(urlView.textContent).toBe(originalUrl.slice(8));
});

test("sidetab handles correctly hiding", () => {
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
    hidden: true,
  });
  expect(sidetab.view.classList.contains("hidden")).toBe(true);
  expect(sidetab.isVisible()).toBe(false);

  sidetab.update({ hidden: false });
  expect(sidetab.view.classList.contains("hidden")).toBe(false);
  expect(sidetab.isVisible()).toBe(true);

  sidetab.updateSearchHidden(true);
  expect(sidetab.view.classList.contains("hidden")).toBe(true);
  expect(sidetab.isVisible()).toBe(false);

  sidetab.updateWillBeDeletedHidden(true);
  expect(sidetab.view.classList.contains("hidden")).toBe(true);
  expect(sidetab.isVisible()).toBe(false);

  sidetab.updateSearchHidden(false);
  expect(sidetab.view.classList.contains("hidden")).toBe(true);
  expect(sidetab.isVisible()).toBe(false);

  sidetab.updateWillBeDeletedHidden(false);
  expect(sidetab.view.classList.contains("hidden")).toBe(false);
  expect(sidetab.isVisible()).toBe(true);
});

test("sidetab handles correctly bursting", () => {
  const sidetab = new Sidetab({
    id: 1,
    index: 1,
  });
  sidetab.burst();
  expect(sidetab.view.classList.contains("bursting")).toBe(true);

  const elem = document.createElement("div");
  sidetab.onAnimationEnd({ target: elem });
  expect(sidetab.view.classList.contains("bursting")).toBe(true);

  elem.classList.add("tab-loading-burst");
  sidetab.onAnimationEnd({ target: elem });
  expect(sidetab.view.classList.contains("bursting")).toBe(false);
});
