## Reporting

You can ask to fix a bug or add a feature.

Search in the [list of open issues](https://framagit.org/ariasuni/tabcenter-reborn/issues?scope=all&utf8=%E2%9C%93&state=opened) to see if it is already reported by someone else.

- If it is the case, you can give us additional information or feedback.
- Otherwise, you can [open a new issue](https://framagit.org/ariasuni/tabcenter-reborn/issues/new?issue%5Bassignee_id%5D=&issue%5Bmilestone_id%5D=).

## Translating

Choose your language and [start translating and reviewing](https://translate.funkwhale.audio/engage/tabcenter-reborn/). Can’t find your own language? [Start a new translation](https://translate.funkwhale.audio/new-lang/tabcenter-reborn/interface/)!

If a string has a comment starting with “Taken from Firefox”, follow the link then click on “LOCALES”, and copy the translation matching your language (if it is present).

Also, context menu items can have accessibility keys. An accessibility key is a letter of the title that is underlined, to inform that hitting that key triggers the action. To set which letter is the accessibility key, put a `&` in front of it. Try not to have duplicates and makes them easy to remember. See section “title” of [menus.create()](https://beta.developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus/create).

Example with English for tab context menu:

- &Reload Tab (the first letter doesn’t conflict with others, so use it)
- &Mute Tab / Un&mute table (try to use the same key for both)
- &Pin / Un&pin Tab (same as above)
- &Duplicate Tab (it could have been U or P if a more frequent action used that)
- Un&load Tab (since U is used later and it has to do with (un)loading)
- Reopen in C&ontainer (R, P and C are already used, focus on container)
- Mo&ve Tabs (M is already used and V is an important sound in the word)
- Close Tab&s (S is significant since it’s the only difference with the last item)
- &Undo Close Tab (D is already taken, N is present in both Unload and Undo)
- &Close Tab (the most frequent action is given priority for first letter)

[![Translation status](https://translate.funkwhale.audio/widgets/tabcenter-reborn/-/interface/svg-badge.svg)](https://translate.funkwhale.audio/engage/tabcenter-reborn/?utm_source=widget)

## Documenting

You can add or improve tweaks to the [wiki](https://framagit.org/ariasuni/tabcenter-reborn/wikis/home).

## Developing

First, check [Design](https://framagit.org/ariasuni/tabcenter-reborn/blob/main/DESIGN.md) and [Technical choices](https://framagit.org/ariasuni/tabcenter-reborn/blob/main/TECHNICAL.md) documents.

You need to have a recent version of Node.js and yarn.

1. Clone this repository
2. Install the dependencies with `yarn install`.
3. Run `yarn run dev` and start hacking! [Here is a list of some things](https://framagit.org/ariasuni/tabcenter-reborn/issues) you could work on.

   To use a version of Firefox other than Release, you need to set the environment variable `WEB_EXT_FIREFOX`, as described in the [web-ext documentation](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#--firefox).

   For example, on Linux I use `env WEB_EXT_FIREFOX=nightly yarn run dev` to launch Firefox Nightly instead.

4. Make sure your changes are correct by testing them in different situations, with containers, search, private browsing and several windows open when it is relevant.

## Making my Firefox theme work with Tab Center Reborn

Themes using a background image are checked for readability before being used.

Note however that themes made with Firefox Color (using the [`additional_backgrounds`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/theme#images) key) will always work right now, so that integration won’t stop working seemingly (to the users) randomly when the contrast is insufficient. Still, you are advised to follow the advices below.

To make your theme compatible/work well with Tab Center Reborn, you need to define a background color (likely matching your the color of your background image — Firefox Color already does that for you) with sufficient contrast with your text/icon color.

Tab Center Reborn checks those colors for contrast:

- Toolbar background and icon
- Tab background and tab text
- Active tab background and active tab text

[Test your colors](https://contrast-ratio.com/), and please aim for at least AA contrast.

Note: Tab Center Reborn accepts worse contrasts to be compatible with less accessible themes, but please avoid relying on it and instead improve the contrast of your theme. This only makes it better for your users!
