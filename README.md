# Issue Creator — Publication Overview plug-in

Plans a print issue and creates its layouts in one go. You open the issue in
Publication Overview, pick templates for the empty page slots, and the whole plan goes to
Studio's Planning API, which instantiates the layouts from their templates with the page
numbers already set.

No InDesign, no file upload, no second login. Supersedes the Electron PoC in `../app`.

## Status: working

Open **Create pages…** in the Publication Overview triple-dot menu:

- Resolves the brand, issue, channel and section from the current filter, so it never asks
  what you are looking at
- Builds a slot grid, seeded from the issue's own expected page count
- Pages already in the issue render **locked and green**, showing the layout name and
  workflow state, and the grid extends if they run past the requested count
- Click a page, then a template, to assign it. Multi-page templates span consecutive pages
  and the selection auto-advances past the spread. `×` clears
- Templates list with previews and page counts; the blank-page template is auto-detected
- Multi-page templates and spreads show **one preview per page**. An object's own `thumb`
  rendition is only its first spread, so a 4-page template would otherwise look like 2
  pages; `RequestInfo: ['Pages']` returns a thumb per page instead
- Each layout takes its category from its own template, not from the page grid's filter
- **Drag a page onto another** to rearrange the plan. Spreads move whole, and a move that
  would land on a page already in the issue is refused
- **Tick or untick pages** to create only some of them. Everything is included by default,
  so a partial run is a deliberate act; `All` / `None` for the common cases
- **Save plan** stores work in progress on this issue without creating anything. Every
  save is a new version, so you can go back to any earlier one
- **Save as template…** stores a named, reusable arrangement not tied to any issue.
  Loading one lays its sequence out from the first free page, so it fits around pages that
  already exist rather than colliding with them
- **Create** sends the selected pages in one `CreateLayouts` call, then re-reads the issue
  to verify they actually landed

Still to build: per-slot category and edition overrides, and a page-range view for very
large issues.

**Not supported: moving pages that already exist in the issue.** The grid rearranges a
*plan*; a created layout is anchored to its real page numbers, and shifting those means
repaging live production content. The Planning API's `ModifyLayouts` could do it, but it
is a different and more dangerous operation than editing a plan, so it is deliberately out
of scope here.

## Build

```
node build-plugin.js     # writes dist/pub-overview-issue-planner.js
```

No transpilation or minification — the deployed file stays readable in the console.

## Deploy

The bundle is served from GitHub Pages, same as the Publication Overview PDF plug-in:

```
https://bennstorey.github.io/pub-overview-issue-planner/dist/pub-overview-issue-planner.js
```

Publishing is one command from the parent repo, which stays the source of truth — the
public repo is produced from `plugin/` with `git subtree`, so there is no second copy to
keep in sync:

```
./scripts/publish-plugin.sh
```

Users need a hard refresh (Cmd-Shift-R) of Studio after a deploy.

### One-time setup

1. **Create the repo.** On github.com, new **public** repo named `pub-overview-issue-planner`,
   owner `bennstorey`. Leave it completely empty — no README, no .gitignore, no licence —
   or the first subtree push will be rejected as a non-fast-forward.
2. **Publish.** Run `./scripts/publish-plugin.sh`. It adds the remote, rebuilds, refuses to
   ship a stale or uncommitted bundle, and pushes.
3. **Enable Pages.** Repo → Settings → Pages → Source: *Deploy from a branch*, branch
   `main`, folder `/ (root)`. Wait a minute, then confirm the URL above loads the
   JavaScript rather than a 404.
4. **Register in Studio.** Management Console → Integrations → Plug-ins →
   **Publication Overview** section (not "Studio" — this plug-in uses `PoUiSdk`, which only
   exists in the Publication Overview child application) → Add new → paste the URL →
   enable.

Only the plug-in is public. The research notes, the superseded Electron PoC and the
customer context stay in the private parent repo.

## Architecture

```
src/                      concatenated in filename order by build-plugin.js
├── 00-header.js          IIFE open, PoUiSdk guard, VERSION
├── 05-dom.js             el() helper, shared by the grid and the dialog
├── 10-config.js          naming defaults, localStorage settings
├── 20-studio-api.js      cookie-session JSON-RPC for index.php and editorialplan.php
├── 30-planning-api.js    CreateLayouts, access check, protocol confirmation
├── 40-issue-data.js      GetPagesInfo issue model, brand/issue/section name resolution
├── 50-templates.js       LayoutTemplate query, page counts from PageRange
├── 55-renditions.js      thumbnail URLs (needs ww-app for the cookie session)
├── 60-naming.js          naming-pattern engine (ported from the PoC)
├── 65-slot-grid.js       slot model — spans, covered pages, locked existing pages
├── 70-planner-dialog.js  the modal
├── 90-registration.js    menu action, window.__issueCreator diagnostics
└── 99-footer.js          IIFE close
```

### The slot model

Ported from the Electron PoC, where it was proven across several real issue builds. A slot
is one page. A multi-page template gives its slot a `span`, and the pages underneath become
`covered` — they still exist so page numbering stays honest, but they are not drawn and
cannot be assigned to. `existing` marks a page already in the issue: locked, and never
touched by a create run.

Assigning over an earlier spread clears that whole spread, and assigning across a page that
already exists in the issue is refused rather than silently skipped.

Note `GetPagesInfo` returns one PageObject per page *per edition*, so the same page arrives
more than once when no single edition is selected; spans are collapsed per layout to
compensate.

## The `__classname__` problem

Studio's JSON-RPC is strongly typed: nested objects need a `__classname__` marker or the
deserializer drops every field and reports them as unspecified — the first probe failed
with "layout template, layout name, Publication or Issue was not specified" while sending
all four.

The planning interface's type names are not in the SDK docs. **Confirmed on Studio 10.67:
it wants the `Pln`-prefixed names**, and rejects the bare names the workflow interface
uses — so the two interfaces do not share a convention despite sharing field names.

`30-planning-api.js` defaults to `pln` and keeps `bare` and `none` in case another version
differs; **Confirm protocol** in the dialog re-establishes it against a real create.

The payload, as sent and accepted:

```json
{ "Layouts": [ { "__classname__": "PlnLayoutFromTemplate",
                 "Template": "Print template A",
                 "NewLayout": { "__classname__": "PlnLayout",
                   "Name": "...", "Publication": "...", "Issue": "...",
                   "PubChannel": "Print", "Section": "News",
                   "Pages": [ { "__classname__": "PlnPage", "PageOrder": 20, "PageSequence": 1 } ] } } ],
  "Ticket": null }
```

`Status` is deliberately never sent: the SDK docs state object state is determined by the
editorial system, not the plan system. The server assigned `Draft` on the confirmation run.

`Section` is Studio's Category, and is **per layout, taken from its own template** — a page
built from the News template lands in News regardless of what the grid is filtered to. It
falls back to the filter's category, or the brand's first, only for a template that has no
category of its own.

**The response cannot confirm the page plan.** Its `Layouts` carry `Id`, `Name` and the
resolved `Publication` / `Issue` / `PubChannel` / `Section` / `Status`, but `Pages` comes
back `null`. Verify with `loadIssueModel()` or by reading `PlannedPageRange`.

## Who can see it

The menu entry only appears for members of an admin user group. The check is
`GetUserProfile` with `RequestInfo: ['Memberships']`; group names differ between servers,
so the list is a setting (`Admin`, `Administrators`, `System Admin` by default):

```js
__issueCreator.setAdminGroups(['Admin'])   // then reload Studio
```

The action is created hidden and revealed once the check passes, because `createAction`
has to run while the menu is being built — registering later, after an async check, is not
reliable. If the check itself fails the entry stays hidden: a restriction that opens up
when it breaks is not a restriction. `__issueCreator.access()` shows what was decided and
why.

⚠️ **This is not a security boundary.** The bundle is fetched from a public URL and runs in
the user's own browser, so anyone determined can edit the check out or call the Planning
API directly. What actually prevents a non-admin creating pages is Studio's own access
rights — the server refuses the calls. This gate keeps the menu entry out of the way of
people who have no business using it, which is a usability guarantee, not a security one.

## Saved arrangements

Both kinds live **in Studio**, so they are visible to everyone rather than trapped in one
person's browser. Object type `Other`, format `text/plain`, contained in a dossier:

| | Object | Dossier |
|---|---|---|
| Plan version — work in progress on one issue | `IssuePlan_<issueId>_v<N>_<YYYY-MM-DD>` | `_Issue Plans` |
| Issue template — named, reusable, not tied to an issue | `IssueTemplate_<name>` | `_Issue Templates` |

**Every save of a plan is a new version**, so any earlier one can be restored from the Load
list. Old versions are pruned beyond `planVersionsToKeep` (20 by default; 0 keeps
everything). Issue templates are still overwritten by name, since they are named things
rather than a history.

The **date in the name comes from the browser** at save time, deliberately. Studio's own
`Modified` is in the server's timezone with no offset marker — UTC-4 on this server — so
listing versions by it showed times hours adrift. Baking the date in at the point of
saving sidesteps the question rather than guessing an offset, and a date is what you
actually want when picking a version.

Plans saved before versioning existed have no suffix and are listed as "before
versioning". Issue ids that share a prefix do not collide: `IssuePlan_2840_v1` is not
matched when listing versions of issue 284.

Neither kind stores existing pages: those belong to the issue, not the plan, and are
re-read fresh every time. Restoring a plan puts it back at the page numbers it was saved
at; loading an issue template lays its sequence out from the first free page. Either way,
entries whose pages have been created in the meantime are skipped and reported rather than
silently dropped.

### How the bytes get there

The JSON is uploaded to the **Transfer Server** and referenced by `FileUrl`, as the PoC
did. The only difference is authentication: the PoC had a ticket, the plug-in has a cookie
session, so the upload carries `ww-app` — the same parameter that makes rendition
downloads work from the browser.

Sending the JSON inline as base64 in the Attachment's `Content` was tried first, to avoid
a second endpoint. **The server rejects it**: `Unable to save attached data to file
(S1001) — Missing function parameter (S1000)`. `Content` is a documented field on
`Attachment`, but this server will not accept it. Reading still handles inline content in
case another version returns it that way.

## Notes on times

Studio returns datetimes in the **server's** timezone, with no offset marker, and that
timezone is neither the viewer's nor necessarily UTC — this server records **UTC-4**, so a
plan saved at 06:49 BST is stored as `01:49`. Parsing those strings as local time would
silently shift every timestamp, so they are shown verbatim and labelled "server time".

## Notes

- `CreateLayouts` takes an **array**, so a whole issue can go up in one request.
- Page position in Publication Overview follows the planning data, not the page numbers
  inside the INDD — confirmed with probe layout 87902, which sat correctly at pages 20-23
  while its `PageRange` still read `002-005`. There is nothing to renumber.
- Diagnostics are on `window.__issueCreator` in the Publication Overview iframe.
