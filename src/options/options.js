"use strict";
/* global browser */

class Options {
  constructor() {
    const options = [
      "optionsAppearanceTitle",
      "optionsAnimations",
      "optionsCompactMode",
      "optionsCompactModeStrict",
      "optionsCompactModeDynamic",
      "optionsCompactModeOff",
      "optionsCompactModeExplanation",
      "optionsCompactPins",
      "optionsThemeIntegration",
      "optionsThemeIntegrationExplanation",
      "optionsBehaviorTitle",
      "optionsSwitchLastActiveTabExplanation",
      "optionsSwitchLastActiveTab",
      "optionsNotifyClosingManyTabs",
      "optionsAdvancedTitle",
      "optionsCustomCSS",
      "optionsCustomCSSWikiLink",
      "optionsCustomCSSChangelogLink",
      "optionsSaveCustomCSS",
    ];
    const changes = [];

    requestAnimationFrame(() => {
      // Group reading the DOM
      for (const opt of options) {
        changes.push([opt, document.getElementById(opt)]);
      }
      const option = "optionsNotifyClosingManyTabsExplanation";
      const optionNode = document.getElementById(option);

      // Group writing the DOM
      for (const [opt, node] of changes) {
        const textNode = document.createTextNode(browser.i18n.getMessage(opt));
        node.appendChild(textNode);
      }
      optionNode.appendChild(document.createTextNode(browser.i18n.getMessage(option, 5)));
      document.body.classList.add("loaded");

      this.setupState();
    });
  }

  setupState() {
    const defaultPrefs = {
      animations: true,
      themeIntegration: true,
      compactMode: 1,
      compactPins: true,
      switchLastActiveTab: true,
      notifyClosingManyTabs: true,
      useCustomCSS: true,
      customCSS: "",
    };

    browser.storage.sync.get(defaultPrefs).then(prefs => {
      requestAnimationFrame(() => {
        for (const pref of Object.entries(prefs)) {
          const element = document.getElementById(pref[0]);
          if (pref[0] === "customCSS") {
            element.value = pref[1];
          } else if (pref[0] === "compactMode") {
            document.querySelector(`[value="${parseInt(pref[1])}"]`).checked = true;
          } else {
            element.checked = pref[1];
            if (pref[0] === "useCustomCSS") {
              this.updateCustomCSSEnabled(pref[1]);
            }
          }
        }
        this.setupListeners();
      });
    });
  }

  setupListeners() {
    document.body.addEventListener("change", e => {
      if (e.target.tagName === "TEXTAREA") {
        browser.storage.sync.set({ [e.target.id]: e.target.value });
      } else if (e.target.tagName === "INPUT") {
        if (e.target.type === "radio") {
          browser.storage.sync.set({ [e.target.name]: parseInt(e.target.value) });
        } else {
          browser.storage.sync.set({ [e.target.id]: e.target.checked });
          if (e.target.id === "useCustomCSS") {
            this.updateCustomCSSEnabled(e.target.checked);
          }
        }
      }
    });

    document.getElementById("optionsSaveCustomCSS").addEventListener("click", () => {
      browser.storage.sync.set({
        customCSS: document.getElementById("customCSS").value,
      });
    });
  }

  updateCustomCSSEnabled(enabled) {
    document.getElementById("customCSS").disabled = !enabled;
    document.getElementById("optionsSaveCustomCSS").disabled = !enabled;
  }
}

new Options();
