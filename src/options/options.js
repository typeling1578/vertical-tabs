"use strict";
/* global browser */

import { DEFAULT_PREFS } from "../common.js";

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
      "optionsSwitchByScrolling",
      "optionsSwitchByScrollingWithCtrl",
      "optionsSwitchByScrollingAlways",
      "optionsSwitchByScrollingNever",
      "optionsSwitchByScrollingWithCtrlExplanation",
      "optionsNotifyClosingManyTabs",
      "optionsAdvancedTitle",
      "optionsCustomCSS",
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
    browser.storage.sync.get(DEFAULT_PREFS).then((prefs) => {
      requestAnimationFrame(() => {
        for (const pref of Object.entries(prefs)) {
          const element = document.getElementById(pref[0]);
          if (pref[0] === "customCSS") {
            element.value = pref[1];
          } else if (pref[0] === "compactMode" || pref[0] === "switchByScrolling") {
            document.querySelector(
              `[name="${pref[0]}"][value="${parseInt(pref[1])}"]`,
            ).checked = true;
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
    document.body.addEventListener("change", (e) => {
      if (e.target.tagName === "INPUT") {
        if (e.target.type === "radio") {
          browser.storage.sync.set({ [e.target.name]: parseInt(e.target.value) });
        } else if (e.target.type === "checkbox") {
          browser.storage.sync.set({ [e.target.id]: e.target.checked });
          if (e.target.id === "useCustomCSS") {
            const enabled = e.target.checked;
            this.updateCustomCSSEnabled(enabled);
            if (!enabled) {
              this.saveCustomCSS();
            }
          }
        }
      }
    });

    document
      .getElementById("optionsSaveCustomCSS")
      .addEventListener("click", () => this.saveCustomCSS());
    document.getElementById("customCSS").addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        this.saveCustomCSS();
      }
    });
  }

  saveCustomCSS() {
    browser.storage.sync.set({
      customCSS: document.getElementById("customCSS").value,
    });
  }

  updateCustomCSSEnabled(enabled) {
    document.getElementById("customCSS").disabled = !enabled;
    document.getElementById("optionsSaveCustomCSS").disabled = !enabled;
  }
}

new Options();
