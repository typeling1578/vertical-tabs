## Reporting

You can ask to fix a bug or add a feature.

Search in the [list of open issues](https://framagit.org/ariasuni/tabcenter-reborn/issues?scope=all&utf8=%E2%9C%93&state=opened) to see if it is already reported by someone else.

- If it is the case, you can give us additional information or feedback.
- Otherwise, you can [open a new issue](https://framagit.org/ariasuni/tabcenter-reborn/issues/new?issue%5Bassignee_id%5D=&issue%5Bmilestone_id%5D=).

## Translating

Choose your language and [start translating and reviewing](https://translate.funkwhale.audio/projects/tabcenter-reborn/interface/). Can’t find your own language? [Start a new translation](https://translate.funkwhale.audio/new-lang/tabcenter-reborn/interface/)!

If a string has a comment starting with “Taken from Firefox”, follow the link then click on “LOCALES”, and copy the translation matching your language (if it is present).

[![Translation status](https://translate.funkwhale.audio/widgets/tabcenter-reborn/-/interface/svg-badge.svg)](https://translate.funkwhale.audio/engage/tabcenter-reborn/?utm_source=widget)

## Documentating

You can add or improve tweaks to the [wiki](https://framagit.org/ariasuni/tabcenter-reborn/wikis/home).

## Developing

First, check [Design](https://framagit.org/ariasuni/tabcenter-reborn/blob/main/DESIGN.md) and [Technical choices](https://framagit.org/ariasuni/tabcenter-reborn/blob/main/TECHNICAL.md) documents.

You need to have a recent version of Node.js.

1. Clone this repository
2. Install the dependencies with `npm i`.
3. Run `npm run dev` and start hacking! [Here is a list of some things](https://framagit.org/ariasuni/tabcenter-reborn/issues) you could work on.

   If you don’t have Firefox Release installed, you should use:

   `env WEB_EXT_FIREFOX=<exe> npm run dev` where `exe` can be `stable`, `beta`, `nightly`, the command to launch Firefox, or a path to the Firefox executable.

4. Make sure your changes are correct by testing them in different situations, with containers, search, private browsing and several windows open when it is relevant.
