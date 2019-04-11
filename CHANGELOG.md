## 0.9.0

* Make toolbar button work correctly and add on/off indicator
* Make new tab menu native and work only on right-click
* Make context menu appear again on right-click in searchbox
* Make top menu bar buttons a little bit bigger with less margin
* Always update scroll shadows (when tabs are moved or window resized)
* Big visual redesign and better integration with custom themes
  * Separate active and contextual identity indicator
  * Add active indicator on pinned compact tabs
  * Make integration with custom themes much much better
* Change sidebar icon to light for dark default and custom themes
* Add description for all translatable strings
* Improve options page layout add explanation for theme integration
* Improve extension description and add AMO long description
* Warn user before closing 4 or more tabs at once
* Improve contributing instructions for translators (CONTRIBUTING.md)
* Improve README.md and list differences with Tab Center Redux
* Show tab as loading if it started loading before sidebar was opened

## 0.8.2

* Remove the bottom border of tab if it’s at window bottom
* Scroll to active tab when hovering it if it’s partially hidden
* Do not scroll when tab is already in view
* Update link for CSS tweaks in option page to Tab Center Reborn’s one
* Update translations, mostly by copying translation from Firefox

## 0.8.1

* Make the addon actually work when installed from AMO (and not only in development)
* Make open in contextual tab feature work

## 0.8.0

* Fix about:addons favicon not colored correctly in dark theme
* Use [photon colors](https://design.firefox.com/photon/visuals/color.html) and improve new tab button margin and centering
* Don’t use last valid favicon when going to a page without one
* Correctly scroll to tab when opened in background from a pinned tab
* Use native context menu for tabs instead of an imitation
* Follow more closely Firefox’s default tab menu entries and behavior
* Add bottom shadow when possible to scroll down and fix top shadow (dis)appearing animation
* Change shortcut to Shift + F1 for all platforms
* Switch to a [new translation platform](https://translate.funkwhale.audio/projects/tabcenter-reborn/interface/)
* Improve documentation for users and contributors
