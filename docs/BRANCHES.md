# Branches: naming & organisation

## The rule
```
<name>/c<checkpoint>-<issue>-<short-description>
```
- all lowercase, words joined with `-`
- `<name>` = `matthew`, `felix`, `ahmed`, `pranav` (or `claude` for Claude's own work)
- `c<checkpoint>` = which checkpoint it's for (`c0`–`c5`)
- `<issue>` = the GitHub issue number it closes

Example: `felix/c2-9-app-screens` = Felix's work for checkpoint C2, closing issue #9.

Why: anyone can glance at the branch list and see **who**, **which checkpoint** and **which task**. GitHub groups branches by the part before `/`, so each person's branches sit together. Pull requests from these branches are labelled automatically (person + checkpoint).

## Your exact branch names
Only create a branch when the task changes files. Check-in-only tasks (e.g. the iPhone test) don't need one.

| Issue | Branch |
|---|---|
| #1 | `matthew/c0-1-setup` |
| #2 | `matthew/c1-2-https-session` |
| #3 | `matthew/c2-3-recipes` |
| #4 | `matthew/c3-4-joining-up` |
| #5 | `matthew/c4-5-deploy-render` |
| #6 | `matthew/c5-6-freeze` |
| #7 | `felix/c0-7-run-skeleton` |
| #8 | `felix/c1-8-iphone-check` |
| #9 | `felix/c2-9-app-screens` |
| #10 | `felix/c3-10-real-remy` |
| #11 | `felix/c4-11-polish-demo` |
| #12 | `felix/c5-12-video-pitch` |
| #13 | `ahmed/c0-13-voice-route` |
| #14 | `ahmed/c1-14-voice-test` |
| #15 | `ahmed/c2-15-voice-connection` |
| #16 | `ahmed/c3-16-latency` |
| #17 | `ahmed/c4-17-second-opinion` |
| #18 | `ahmed/c5-18-reliability` |
| #19 | `pranav/c0-19-core-rules` |
| #20 | `pranav/c1-20-savage-test` |
| #21 | `pranav/c2-21-personality` |
| #22 | `pranav/c3-22-cookalong-log` |
| #23 | `pranav/c4-23-accuracy` |
| #24 | `pranav/c5-24-final-personality` |

**New tasks** (e.g. a bug found at joining-up, issue #31): `<name>/c<checkpoint>-31-<what>`, e.g. `felix/c3-31-timer-overlap`.

## Lifecycle of a branch
1. Start from the latest `main`: `git checkout main && git pull && git checkout -b felix/c2-9-app-screens`
2. Commit small, push at least every hour: `git push -u origin felix/c2-9-app-screens`
3. Open a pull request with **`Closes #9`** in the description. It gets labelled automatically.
4. Once merged, the branch is finished. **Don't keep working on it**: start the next one from fresh `main`.
5. Merged branches get deleted (GitHub's "automatically delete head branches" setting).

## `main`
`main` is always the working version. Nobody pushes to it directly. Everything goes in through a reviewed pull request with the automatic check passing.
