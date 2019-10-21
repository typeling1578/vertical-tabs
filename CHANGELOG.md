## 2.1.1

- Fix pinned tab not staying at the top of the view while scrolling

## 2.1.0

- Improve a lot options page appearance, match Firefox design
- Fix closing more than 4 tabs not working under certain circumstances
- Add icons to each items of the tab context menu
- Better handle theme integration to work with Firefox Color
- At startup, scroll to the current tab before displaying the sidebar
- Add “Switch by scrolling” option
- Lots of small fixes and improvements

For Custom CSS users:

- use `.not-selected-since-load` instead of `[notselectedsinceload=true]`
- `.sound` and `.audible` are now on the tab instead of the favicon overlay
- you can now use `[data-url]` to style tabs depending on URL content

## 2.0.2

- Translation updates (100%: English, Esperanto, French, Italian)

## 2.0.1

- Make settings handling and migration to sync more reliable
- Make search field on Windows slightly rounded, like the url bar
- Fix tabs sometimes not being fully/correctly removed
- Improve contributing guide for translations
- Add to contributing guide section on how to make theme compatible with TCRn

## 2.0.0

- Fix wrong focus after closing new tab opened with new tab button
- Don’t animate tab moving to avoid scrollbar jumps
- Don’t display pinned tab list when searching and no result is pinned
- Add tooltip to audible/unmute button on tabs
- Notify and allows to undo when closing many tabs, instead of asking
- Fix bottom shadow appearing when there’s only one tab remaining
- Use a replacement for tabs.duplicate() to avoid limitations and bugs
- Improve how tabs hiding is managed to avoid bugs
- Improve performance of animations of opening/closing of tab
- Make close button bigger so it’s much easier to click on
- Update spinner (use current one from Firefox) to improve performance
- Add entries to new tab context menu (right-click menu)
- (Un)shrink tabs only if pointer is out of the sidebar
- Synchronize settings with Firefox Sync
- Improved theme integration, removed Dark theme since it’s no longer useful
- Add keyboard shortcut Shift + F2 to switch to last active tab
- Add option to disable animations
- Improve sidebar startup performance

For Custom CSS users:

- Use `--tab-height-normal` and `--tab-height-compact` to change tab height.
- Dark theme is available on the wiki if you want to apply it manually:
  https://framagit.org/ariasuni/tabcenter-reborn/wikis/themes

## 1.0.0

- New awesome logo! No more on/off badge to make it stand out.
- Lots of changes to improve performances!
- Animations for opening/closing/moving tabs!
- Add option to disable warning when closing more than 5 tabs
- Add option to quickly disable or re-enable custom CSS
- Don’t use label for new tab button so search bar is always expanded
- Improve a bit custom theme handling
- Don’t open new window when tab is dropped on topmenu or Firefox’s bookmark bar
- Use “Favicon-only pinned tabs” label instead of “Compact pinned tabs”
- Don’t reorder tabs when filtering
- Reintroduce different color when hovering tab and improve dark theme
- Search with default engine when dropping text onto sidebar
- Add shortcuts when clicking New Tab button and menu
  - Ctrl + click opens after current tab if default is at the end
    (and opens at the end if default is after current tab)
  - Shift + click opens a new window
  - Ctrl + Shift + click opens a new private window

## 0.10.1

- Fix scrolling when pinning/unpinning a tab
- Don’t highlight bottom shadow when opened tab is fully in view
- Use on/off text for button so that it displays well for all fonts
- Don’t open new window when the only tab is dropped outside sidebar

## 0.10.0

- New Tab tooltip also appears when hovering the icon
- Add option to switch to last tab when clicking current one
- Change browser toolbar button color according to custom theme
- Add a private tab indicator where a container indicator should appear
- Don’t show options relative to containers when in private window
- Add option to unload tabs in context menu
- Set tab moved from a window as active in the new window
- Open tab in a new window if it’s dropped outside a sidebar
- Don’t scroll to background tab if it push active tab outside view
- Full italian translation
- Performance improvements

## 0.9.0

- Make toolbar button work correctly and add on/off indicator
- Make new tab menu native and work only on right-click
- Make context menu appear again on right-click in searchbox
- Make top menu bar buttons a little bit bigger with less margin
- Always update scroll shadows (when tabs are moved or window resized)
- Big visual redesign and better integration with custom themes
  - Separate active and contextual identity indicator
  - Add active indicator on pinned compact tabs
  - Make integration with custom themes much much better
- Change sidebar icon to light for dark default and custom themes
- Add description for all translatable strings
- Improve options page layout add explanation for theme integration
- Improve extension description and add AMO long description
- Warn user before closing 4 or more tabs at once
- Improve contributing instructions for translators (CONTRIBUTING.md)
- Improve README.md and list differences with Tab Center Redux
- Show tab as loading if it started loading before sidebar was opened

## 0.8.2

- Remove the bottom border of tab if it’s at window bottom
- Scroll to active tab when hovering it if it’s partially hidden
- Do not scroll when tab is already in view
- Update link for CSS tweaks in option page to Tab Center Reborn’s one
- Update translations, mostly by copying translation from Firefox

## 0.8.1

- Make the addon actually work when installed from AMO (and not only in development)
- Make open in contextual tab feature work

## 0.8.0

- Fix about:addons favicon not colored correctly in dark theme
- Use [photon colors](https://design.firefox.com/photon/visuals/color.html) and improve new tab button margin and centering
- Don’t use last valid favicon when going to a page without one
- Correctly scroll to tab when opened in background from a pinned tab
- Use native context menu for tabs instead of an imitation
- Follow more closely Firefox’s default tab menu entries and behavior
- Add bottom shadow when possible to scroll down and fix top shadow (dis)appearing animation
- Change shortcut to Shift + F1 for all platforms
- Switch to a [new translation platform](https://translate.funkwhale.audio/projects/tabcenter-reborn/interface/)
- Improve documentation for users and contributors
