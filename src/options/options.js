/* global browser */

class TabCenterOptions {
  constructor() {
    this.setupLabels();
    this.setupStateAndListeners();
  }

  setupLabels() {
    const options = [
      "optionsAppearanceTitle",
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
      "optionsAdvancedTitle",
      "optionsCustomCSS",
      "optionsCustomCSSWikiLink",
      "optionsSaveCustomCSS",
    ];
    for (const opt of options) {
      document.getElementById(opt).textContent = browser.i18n.getMessage(opt);
    }
    const opt = "optionsWarnBeforeClosing";
    document.getElementById(opt).textContent = browser.i18n.getMessage(opt, 5);
  }

  setupStateAndListeners() {
    this._setupCheckboxOption("darkTheme", "darkTheme");
    this._setupCheckboxOption("themeIntegration", "themeIntegration");
    this._setupDropdownOption("compactMode", "compactModeMode");
    this._setupCheckboxOption("compactPins", "compactPins", true);
    this._setupCheckboxOption("switchLastActiveTab", "switchLastActiveTab", true);
    this._setupCheckboxOption("warnBeforeClosing", "warnBeforeClosing", true);
    this._setupCheckboxOption("useCustomCSS", "useCustomCSS", true);

    // Custom CSS
    browser.storage.local
      .get({
        customCSS: "",
      })
      .then(prefs => {
        document.getElementById("customCSS").value = prefs["customCSS"];
      });
    document.getElementById("optionsSaveCustomCSS").addEventListener("click", () => {
      browser.storage.local.set({
        customCSS: document.getElementById("customCSS").value,
      });
    });
  }

  _setupCheckboxOption(checkboxId, optionName, defaultValue = false) {
    const checkbox = document.getElementById(checkboxId);
    browser.storage.local
      .get({
        [optionName]: defaultValue,
      })
      .then(prefs => {
        checkbox.checked = prefs[optionName];
      });

    checkbox.addEventListener("change", e => {
      browser.storage.local.set({
        [optionName]: e.target.checked,
      });
      if (optionName === "useCustomCSS") {
        document.getElementById("customCSS").disabled = !e.target.checked;
        document.getElementById("optionsSaveCustomCSS").disabled = !e.target.checked;
      }
    });
  }

  _setupDropdownOption(drowdownId, optionName) {
    const dropdown = document.getElementById(drowdownId);
    browser.storage.local
      .get({
        [optionName]: 1,
      })
      .then(prefs => {
        dropdown.value = prefs[optionName];
      });

    dropdown.addEventListener("change", e => {
      browser.storage.local.set({
        [optionName]: e.target.value,
      });
    });
  }
}

new TabCenterOptions();
