/* global browser */

class TabCenterOptions {
  constructor() {
    this.setupLabels();
    this.setupState();
    this.setupListeners();
  }

  async setupLabels() {
    const options = [
      "optionsAppearanceTitle",
      "optionsAnimations",
      "optionsCompactMode",
      "optionsCompactModeStrict",
      "optionsCompactModeDynamic",
      "optionsCompactModeOff",
      "optionsCompactModeExplanation",
      "optionsCompactPins",
      "optionsDarkTheme",
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
    for (const opt of options) {
      document.getElementById(opt).textContent = browser.i18n.getMessage(opt);
    }
    const opt = "optionsNotifyClosingManyTabsExplanation";
    document.getElementById(opt).textContent = browser.i18n.getMessage(opt, 5);
  }

  async setupState() {
    const defaultPrefs = {
      animations: true,
      darkTheme: false,
      themeIntegration: false,
      compactMode: 1,
      compactPins: true,
      switchLastActiveTab: true,
      notifyClosingManyTabs: true,
      useCustomCSS: true,
      customCSS: "",
    };

    const prefs = await browser.storage.sync.get(defaultPrefs);

    for (const pref of Object.entries(prefs)) {
      const element = document.getElementById(pref[0]);
      if (pref[0] === "customCSS") {
        element.value = pref[1];
      } else if (pref[0] === "compactMode") {
        element.value = parseInt(pref[1]);
      } else {
        element.checked = pref[1];
        if (pref[0] === "useCustomCSS") {
          this.updateCustomCSSEnabled(pref[1]);
        }
      }
    }
  }

  setupListeners() {
    document.body.addEventListener("change", e => {
      if (e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") {
        browser.storage.sync.set({ [e.target.id]: e.target.value });
      } else if (e.target.tagName === "INPUT") {
        browser.storage.sync.set({ [e.target.id]: e.target.checked });
        if (e.target.id === "useCustomCSS") {
          this.updateCustomCSSEnabled(e.target.checked);
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

new TabCenterOptions();
