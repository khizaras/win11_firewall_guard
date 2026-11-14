I have enough. But thorough perhaps no need more tool calls. Yet "every relevant ... README" website no README, root read. Asset all inline. Good.

Should have final response structured with scope/method and no mods/services. Exact paths use backticks absolute? User requested exact file paths. I can define root variable `c:\develop...` then relative paths? "Exact file paths" likely include `website/index.html` enough but better at top root and all referenced project-relative paths rooted there. Say all paths below relative to exact root, and use full for key. Could include absolute root once and project-relative exact. User wants exact paths, relative are exact within root. Perhaps use absolute paths in main issue references cumbersome. Define `ROOT = c:\develop\win11_firewall_guard\firewall_guard_fluent` and references `website/index.html:223-225`. That's standard.

Report sections:
1 Executive summary with overall assessment and release recommendation "polished static product narrative, not launch-ready due safety claims and accessibility/progressive enhancement; no broken internal links found statically."
2 Inventory/architecture/nav.
3 Page content/CTAs table.
4 Design system.
5 Responsive/interactions.
6 Links/forms/downloads functionality matrix.
7 Accessibility.
8 SEO.
9 Dependencies/build/run.
10 Product claim verification table supported + issues.
11 Code quality strengths/issues prioritized.
12 Reusable patterns/future requirements.
Could combine avoid repetition.

Prioritized findings table with severity and refs then claim table. Should not repeat issues too many times but okay.
Perhaps top key findings:
- Critical dryrun mismatch and removal behavior
- High no-JS and reduced motion
- High claim mismatches outbound/removal/process
- Medium a11y tabs/horizontal/spec
- Medium website discovery conversion
- Low metadata/code maint.

Detailed product claims table 10 rows.

Be precise batch remove bug:
`remove_rules_batch` line164 passes `items` argument literal to _apply_batch, then line168 refers undefined `items`. Yes actual static NameError. `_apply_batch` executes elevated script first at121, so deletion occurs before NameError. main catches exception at138-139 returns HTTP500 and doesn't update DB. This is important, include severity critical/high.
Dry-run deletion:
UI RemoveDialog dry label but calls same mutation no branch; main deletion no dry. At website broad dry-run copy maybe refers blocks only? Index line224 "The default records what you meant to block" only block. Operations "Dry-run. Records the intent. Does not change Windows Firewall." broad. Specs dry-run default not listed. Product UI removal explicitly says dry-run. Website index how block works no removal. Still state "The site's broad Operations wording is unsafe/incomplete; actual removals bypass dry-run." Do not say default currently true. Both issues independent.
Default dry run false:
Main `CFG` read settings actual. Overview returns CFG true fallback but actual false. UI uses API. Good.
Outbound:
Website overall product marketed outbound but spec line51 "Outbound for managed workflow" not necessarily says only; line50 Action block only explicit, direction "Outbound for managed workflow" can mean primary default. UI direction dropdown includes inbound, so claim should say "Outbound by default; inbound also selectable" not call outright false. Summary "overly narrow" rather than contradiction.
Removal "Only rules this console created":
Single remove checks prefix. UI managed rules likely DB list only so normal UI only own DB names, but API can delete any FGF prefix if caller knows name, token needed. Claim in normal UI arguably true; code guarantee only prefix. Phrase "Enforcement is weaker than wording".
Process critical:
UI disabled based same block_reason; backend hardcoded list. Claim should say "selected critical processes" not all.
Sort/filter:
Action columns intentionally no sorting/filter; copy absolute should say data columns. Good.
Node:
Specs "only to install or rebuild dashboard" perhaps product Node required to run dev server, but installing includes first run and rebuilding only, "only to install or rebuild" strongly says not needed to run built. Since default launcher uses dev server, needs Node runtime each run. Single process mode optional. Qualify.
Python:
`py -3.11` with only 3.12 installed may fail. Should note `py -3.11` specifically asks 3.11, not at least. Good.
Windows10:
No explicit test evidence, not claim false. Root README validation status line61 only Windows11 verified. Mark unverified.
Metrics:
Specs line57 about3 CPU etc true; Memory disk3 GPU4 frontend; domain5 backend.
"Last two minutes" perhaps app chart 3 minutes; website hero illustration not actual and footer says illustrations. Could put low priority content consistency.
- Also root README says two-minute, app three; website just illustration. Avoid unnecessary.
"Every page earns its place" subjective not verify.
- "The same details view throughout" app drawers different DetailDrawer vs custom Traffic Drawer/ProcessDetailDrawer, visually same pattern perhaps okay.
- "Sort any column" in Monitor data columns yes.
- "Live firewall events" query polling 3sec not push; standard. Can say supported as near-live polling, not continuous stream.
- "no allow rules" code only block; inventory reads allow not creates. supported.
- "API bound local" yes settings and start.

- "Not signed commercial" no installer, code no signing config; supported by docs.
- "no TLS" no TLS libs, capture TCP bytes only. supported static.
- "event audit optional capture" supported.

Website issue "all reveal invisible without JS" CSS lines192, JS 11-21. Note SEO crawlers can parse DOM but users no content; at no JS mobile nav also CSS hidden 201-206. Wordmark remains index only, footer links still visible? Reveal not footer, footer link visible. Main sections not all reveal? Some cards hscroll `.card` not reveal but parent headings reveal; index hscroll cards visible; scrub not reveal text visible but stage initial visible; pair children reveal invisible. Operations articles reveal invisible. So "much of page content invisible" not all. Mobile navigation product links hidden, global nav hidden until button JS; footer links provide one path but not full nav. State accurately.
- With JS disabled menu button still visible but no action. Desktop global nav visible so nav okay; mobile menu no action and product links hidden.
- `noscript` absent.
- Fix CSS default visible, add `.js .reveal`, set js class early; use details nav fallback maybe.
- reduced motion scrub height remains 320vh; no JS? same.
- Scroll performance setStep repeated.
- "role tablist" no role tabs etc exact.
- Horizontal keyboard `.hscroll` no tabindex. Content itself readable via virtual cursor even offscreen? Screen readers can access; keyboard sighted scrolling issue. Phrase "no explicit keyboard-scroll affordance/focusable region" not completely inaccessible universally.
- dt/dd invalid exact spec lines43-62; add `<dl class=specgrid>`.
- `aria-current` global nav no current. mobile product bar hidden.
- Skip target main perhaps browser behavior, low.
- menu missing aria-controls etc low.

"SEO launch gaps" no favicon etc all files confirm. robots and sitemap not mandatory, phrase optional but expected public launch.
- No actual host known so canonical pending.
- Unique desc good.

"Code quality" line refs repeated header each pages 11-34, inline styles feature37 etc, script unthrottled53-60. No `.draw` CSS line search I inspected all, class at features120 no rules in CSS1-230. State dead hook, chart itself static (but copy refers app not illustration).
- Unneeded CSS `.cta.light` line76, `--good` line11 no usage. Low.
- No tests website, no link checker.
- No SRI needed no thirdparty.

"Strengths" in each section enough but separate summary list perhaps.
"Reusable patterns" list with caveats.

Should include no modifications/services at end/method.

Should I mention security no external runtime and token warning good. yes.

Could mention no downloads means "How to run it" works as navigation but does not provide runnable artifact. Operations shows `.bat` filename but cannot click. All local app URLs text, appropriate to avoid links when app not running but could link conditionally? A marketing page cannot launch local app. Provide copy buttons.
- If served from file, relative `operations.html` works.
- Static host root if website folder only, operations references backend file not accessible; just textual instructions assume source package. No download/source means operations not actionable for visitor who only has website. Key marketing deliverable weakness.
- No pricing/license/contact not necessarily requirement; mention missing source/download/docs is primary, optional project/evidence.
- No real screenshots/product proof beyond illustrations. Footers disclaim honest, but product marketing could improve credibility with actual captures/video and verified compatibility.

"Page-by-page content and CTAs" include operations no direct external CTA. Good.

Should report not overly massive perhaps ~4500 words. Thorough User explicitly thorough. I can aim ~3000 words with tables. I'll draft around 2500-3500.

Detailed references formatting `website/index.html:37-44` exact. All project relative to root. For full exact path in inventory perhaps `c:\...\website\index.html`. Define root and say paths below relative. This satisfies.

I'll ensure no accidental statement "dry-run default false" as actual running service not tested; static config says false. Use "fresh load of this workspace would read false".
- launcher may currently API running with config loaded differently, no service checks. Good.
- no run build. Link works statically only.

Potential issue CORS PATCH uncovered but not website claim directly. Should I include in product claims? Optional elevated domain refresh not toggling. Could add "Additional product risk noticed while validating domain claims: dev-server CORS omits PATCH even though UI uses PATCH, so pattern enable/disable likely fails through default 5173 origin." This is concrete and relevant to domain patterns. But User asked website deliverable, avoid expanding too far. Yet "Compare claims with code where practical" this supports functionality caveat. If include too many product bugs distracts. Dry run and remove bug enough. CORS issue serious:
main line21 allow_methods GET POST DELETE, API setDomainPatternEnabled PATCH line139 and main248; default dev origin 5173 cross-origin from 5173 to8765. Browser preflight will disallow PATCH. Website says domain worker can refresh set; even if toggle broken, patterns default enabled and add/apply works. Not direct contradiction. Could mention under "additional verification risk" if thorough. But no runtime test, "would be blocked by CORS in dev mode" standards clear. FastAPI CORS allow_methods doesn't include PATCH, preflight returns 400. Built same origin bypass. This impacts domain feature marketing. Include perhaps one bullet "Domain pattern activation toggle is inconsistent in default dev mode" with refs. That makes report more valuable.
- Product API CORS also allow_headers Authorization Content-Type okay.
- `GET` health no auth irrelevant.
- No `PATCH` in CORS indeed.
- User says do not start services; static.
- Product source mojibake could be code quality but not website. Avoid.

Potential product security process termination no elevation, not main.
- Remove batch bug may be caught by unit tests? root says tests cover batch rule construction not execution, explains.

Perhaps domain auto-refresh remove rules via broker no bug if worker, default direct apply if removing invokes bug. Marketing "worker can refresh every 5m" uses broker and works perhaps. Fine.

Claims table:
Claim | Evidence | Assessment:
- Local stack supported
- Batch create supported
- Telemetry supported
- Wildcards supported with polling/worker
- Policy/events supported
Then exceptions table with 9.
No need CORS separate from exceptions if domain functionality caveat.

Issue priorities separate from claims:
Release blockers:
1 Safety copy/product mismatch dry run and removal.
2 Product batch removal bug.
3 Progressive enhancement/a11y high not release blocker perhaps.
Then lower.

Could combine claims findings and prioritized recommendations to avoid duplication:
Section "Claim verification and correctness (highest priority)" table all.
Section "Website engineering findings" table severity.
Then strengths/reuse.

I should state overall no broken links found, all four pages complete. Good.

I'll formulate now.<|close|>think<|sep|># Website deliverable review

**Project root:** `c:\develop\win11_firewall_guard\firewall_guard_fluent`  
Paths below are relative to that root.

**Method:** Read-only static inspection of every file in `website/`, plus the root README, launchers, product configuration, and relevant frontend/backend code for claim verification. No files were modified, no services were started or stopped, and no browser/runtime tests were performed. Link and interaction findings therefore distinguish static verification from runtime certification.

## 1. Executive assessment

The website is a compact, polished, four-page static product narrative with:

- A coherent journey from **Overview → Features → Specifications → Operations**.
- Strong visual consistency, responsive layouts, custom inline illustrations, and no third-party runtime dependencies.
- Unusually good safety and limitation copy: loopback-only architecture, no TLS inspection, existing-session caveats, policy limitations, and development-token warnings.
- Valid internal page/fragment targets and shared CSS/JavaScript.

It is **not yet a reliable public launch deliverable**, primarily because:

1. **The dry-run safety story conflicts with the current product configuration and removal implementation.**
2. **Batch rule removal contains a static backend defect that can report failure after deleting rules.**
3. Several absolute marketing claims are broader than the implementation.
4. Much of the site disappears without JavaScript, and the scroll story has accessibility and reduced-motion problems.
5. There is no actual download, source, documentation, or runnable-product link, so the Operations CTA is instructional rather than actionable for a new visitor.

---

## 2. Site architecture and navigation

### Complete website inventory

```text
website/
├── index.html            Overview and primary product story
├── features.html         Feature narrative
├── specifications.html   Requirements, architecture, and limits
├── operations.html       Launch, security, and troubleshooting
├── site.css              Shared design system and responsive rules
└── site.js               Menu, reveal, and scroll-story behavior
```

There are **no separate image, font, video, favicon, configuration, README, package, build, or deployment files** in `website/`. All illustrations and the shield logo are inline SVG.

### Navigation model

Every page contains:

- A skip link to `#content`.
- A sticky global header with wordmark and four links:
  - Overview
  - Features
  - Specifications
  - Operations
- A second sticky product bar repeating those links and adding a contextual CTA.
- A footer linking to the next logical page.

Examples: `website/index.html:11-34`, `website/operations.html:11-34`.

The product bar uses `aria-current="page"` correctly. The global navigation does not expose the current page, and on screens below 900 px the product links are hidden, so the mobile menu loses visible current-page context.

### CTA journey

| Page | Primary navigation/CTA | Footer destination |
|---|---|---|
| Overview | “Explore the features,” “See the specifications,” “How to run it” | Operations |
| Features | Product-bar “How to run it” | Specifications |
| Specifications | Product-bar “How to run it” | Operations |
| Operations | Product-bar “Start” links to `#start` | Overview |

This is a sensible narrative funnel, but there is no acquisition or conversion action beyond reading instructions.

---

## 3. Page-by-page content and CTAs

### `website/index.html` — Overview

**Content**

- Hero: “Firewall Guard. Outbound control for this PC,” with service/program/address blocking and investigation positioning (`:37-44`).
- Large illustrative dashboard with sample connections, rules, memory, and charts (`:45-78`).
- Four-stage scroll story:
  1. Select rows.
  2. Confirm the batch.
  3. Approve once.
  4. Verify each rule (`:81-150`; text also in `website/site.js:27-32`).
- Memory, GPU, and disk product pages (`index.html:152-195`).
- Traffic attribution, DNS-cache hostnames, wildcard resolution, and no TLS inspection (`:197-219`).
- Dry-run safety message (`:221-226`).
- Horizontally scrolling highlights for process details, table behavior, managed-rule removal, and loopback-only operation (`:228-282`).

**CTAs**

- Features and Specifications hero links.
- Operations in the product bar and footer.
- Four buttons controlling the scroll story.

**Strength:** The footer explicitly states that illustrations are not live data (`:284-287`), reducing the risk of fabricated-dashboard claims.

### `website/features.html` — Features

**Content**

- Shared table/detail interaction model (`:37-41`).
- Process and service metadata, including signer, version, command line, and parent (`:43-65`).
- TCP/UDP, IPv4/IPv6 connection snapshots and distinct-address blocking (`:67-88`).
- Wildcard-domain resolution through the DNS cache and `Resolve-DnsName`, with approximately five-minute elevated refresh (`:90-110`).
- CPU, memory, network, disk, per-core, and process monitoring (`:112-126`).
- Policies as a non-enforcing catalog and structured firewall events (`:128-139`).

**CTAs**

- No page-specific hero CTA beyond shared navigation.
- Footer advances to Specifications.

**Issue:** The chart SVG has `class="draw"` at `features.html:120`, but `site.css` contains no `.draw` rule and `site.js` does not reference it. The illustration itself is static despite the apparently unfinished animation hook.

### `website/specifications.html` — Specifications

**Content**

- Local browser/API/elevated-PowerShell architecture (`:37-40`).
- Eighteen specification rows covering:
  - Windows, Python, Node.js, and rights.
  - Ports and React/Fluent UI.
  - Block-only rules, direction, naming, grouping, and batch size.
  - Removal, verification, existing sessions, sampling, domains, policies, and process termination (`:42-63`).
- Explicit limitations concerning telemetry, Group Policy, VPNs, and other security products (`:65-70`).
- Development-product warning in the footer (`:72-75`).

**CTAs**

- Operations in the product bar and footer.

**Markup issue:** `<dt>` and `<dd>` are used without a containing `<dl>` at `:43-62`. The visual grid works, but the HTML definition-list semantics are invalid. `.specgrid` itself should be a `<dl>`.

### `website/operations.html` — Operations

**Content**

- “Two windows. This PC only” launch introduction (`:37-40`).
- `Start Firewall Guard.bat` behavior and ports (`:42-47`).
- Requirement to leave API/dashboard consoles open and use the stop launcher (`:48-51`).
- Optional built-dashboard serving through the backend (`:52-55`).
- Dry-run versus live behavior (`:59-70`).
- Development-token and loopback security instructions (`:72-76`).
- Batch, domain-worker, audit, and capture summaries (`:77-90`).
- Empty-page, existing-session, and unavailable-GPU troubleshooting (`:93-97`).

**CTAs**

- “Start” scrolls to the instructions at `#start`.
- Footer returns to Overview.

**Conversion gap:** `Start Firewall Guard.bat` is only a heading, not a download. The two local URLs are plain text rather than links (`:46`, `:54`). There is no source archive, repository, README, installation package, or copy-command button. A visitor who has only the website cannot obtain or run the product from it.

---

## 4. Visual design system

### Color

Defined centrally in `website/site.css:1-15`:

- Primary ink: `#1d1d1f`
- Muted text: `#6e6e73`
- Paper: `#ffffff`
- Stage: `#f5f5f7`
- Black sections: `#000000`
- Primary blue: `#0071e3`
- Link blue: `#0066cc`
- Hairlines: `rgba(0, 0, 0, 0.08)`

Additional dark-section and illustration colors are hardcoded in HTML/SVG, including `#a1a1a6`, `#d2d2d7`, `#30b04a`, and status greens. This slightly weakens the token model but produces a coherent monochrome-and-blue, premium desktop-product aesthetic.

### Typography

`site.css:13-26`, `:84-95`, `:132-146`:

- Display stack: Segoe UI Variable Display, SF Pro Display, system fallbacks.
- Text stack: Segoe UI Variable Text, SF Pro Text, system fallbacks.
- Code: Cascadia Mono/ui-monospace (`:184`).
- Body: 17 px, 1.47 line height, slightly negative tracking.
- Hero: responsive 48–80 px, weight 600.
- Display headings: responsive 40–56 px.
- Split-section headings: responsive 36–48 px.
- Lead copy: 21 px.
- Card/tile headings: 28 px.
- Navigation/footer: 12 px.

No font downloads are required, which is good for privacy, performance, and offline rendering. The small navigation/footer text is readable but not especially generous.

### Spacing, layout, and components

- Sticky header heights: 48 px and 52 px (`site.css:37-76`).
- Chapter spacing: `120px 22px` (`:126`).
- Content widths:
  - Narrow: 720 px
  - Wide: 1120 px
  - Horizontal rail: 1200 px
  - Specifications: 980 px (`:130-131`, `:162`, `:176`)
- Major cards: 28 px radius; pill controls use 980 px radius.
- Reusable patterns:
  - `.hero`
  - `.chapter`, `.stage`, `.black`
  - `.pair`
  - `.tiles` / `.tile`
  - `.hscroll` / `.card`
  - `.specgrid`
  - `.foot`
- Motion:
  - Reveal-on-scroll
  - Floating hero
  - Rising story layers
  - Scroll-driven four-step narrative
  - Native horizontal scroll snapping

The design is consistent and polished. Inline styles in `features.html`, `specifications.html`, and especially `operations.html` bypass that system and should become modifiers or utility classes.

---

## 5. Responsiveness and interactions

### Responsive behavior

The single major breakpoint is 900 px (`website/site.css:201-213`):

- Global navigation becomes a Menu-button disclosure.
- Product-bar links are hidden.
- Tiles and split layouts become one column.
- Specification rows stack.
- The scroll story changes from a 320vh sticky sequence to normal flow.
- Hero minimum height is removed.

Other useful behavior:

- Fluid typography via `clamp()`.
- Illustrations scale through `max-width: 100%`.
- Horizontal cards use `min(380px, 82vw)`.
- Footer content wraps.

**Limitations**

- Large 120 px chapter padding remains on small screens, making already long pages longer.
- There are no short-viewport adaptations for the desktop 100vh sticky story.
- Mobile navigation has no non-JavaScript fallback.
- The current-page indicator disappears with the product links.

### Implemented interactions

`website/site.js` provides:

1. **Mobile menu:** toggles `.open` and `aria-expanded` (`:2-9`), matching `site.css:201-205`.
2. **Reveal animations:** uses `IntersectionObserver`, with a fallback that shows elements (`site.js:11-21`).
3. **Scroll story:** updates heading, description, SVG step, and current dot (`:23-60`).
4. **Step buttons:** directly select a story state (`:44-46`).

The controls use `type="button"`, avoiding accidental form submission.

**Performance concern:** Every scroll event calls `setStep`, even when the step has not changed (`site.js:53-60`). That repeatedly rewrites attributes and `textContent` after layout reads. Cache the current step and throttle updates with `requestAnimationFrame`; disable the scroll handler entirely in the mobile/static layout.

---

## 6. Links, forms, downloads, and functional status

### Statically verified

- `index.html`, `features.html`, `specifications.html`, and `operations.html` all exist and match their navigation targets.
- Every page’s `#content` target exists.
- `operations.html#start` exists at `operations.html:42`.
- Every page references existing `site.css` and `site.js`.
- No external links, `mailto:`, `tel:`, or new-window links are present.
- No forms, input fields, submissions, trackers, or network requests exist in the marketing site.
- No downloads are offered.

**Result:** No broken internal hyperlink or missing local CSS/JS target was found statically.

### Interaction status from code inspection

- Menu and reveal logic are internally consistent and should work in modern browsers with JavaScript.
- Story buttons and scroll calculations are bounded correctly from step 0 through step 3.
- Direct `file://` viewing is plausible because there are no fetches or module imports, although it was not browser-tested.
- Actual browser layout, keyboard behavior, and interaction execution remain unverified.

### Major progressive-enhancement defect

`.reveal` starts at `opacity: 0` in `site.css:192`; only JavaScript adds `.show`. Without JavaScript:

- Much of the principal page copy remains invisible.
- At mobile widths, both navigation systems are unavailable: the global nav is hidden until JavaScript opens it, and product links are CSS-hidden.

The safe pattern is visible content by default, with hidden pre-reveal states applied only under an early-added `.js` class, plus a `<noscript>` navigation fallback.

---

## 7. Accessibility

### Strengths

- `lang="en"`, charset, and mobile viewport on every page.
- One descriptive `<h1>` per page and generally logical heading hierarchy.
- Semantic `header`, `nav`, `main`, `section`, `article`, and `footer` elements.
- Skip links and visible `:focus-visible` outlines (`site.css:29-35`).
- Decorative SVGs are consistently `aria-hidden`.
- Icon-only story buttons have accessible labels.
- Reduced-motion handling exists for smooth scrolling, floating, layer animation, and reveals (`site.css:215-230`; `site.js:11`, `:48-51`).
- No autoplay media, flashing content, or motion-controlled input requirement.

### Concrete issues

1. **Incorrect tab semantics**  
   `index.html:87-92` declares `role="tablist"`, but the buttons have no `role="tab"`, `aria-selected`, `aria-controls`, associated `tabpanel`, or arrow-key behavior. They use `aria-current` instead. Either implement the complete tabs pattern or remove `role="tablist"` and treat them as ordinary step-selector buttons.

2. **Very small story-button targets**  
   The buttons are only `36px × 8px` (`site.css:113-118`). They do not meet a 24×24 CSS-pixel target without additional spacing/hit area.

3. **Dynamic changes are not announced**  
   The story heading and detail change without an `aria-live` region or properly associated tab panel. A screen-reader user activating a dot may not discover the changed text, which precedes the controls.

4. **Reduced-motion users still get the long sticky scene**  
   JavaScript selects the final step for reduced motion (`site.js:48-50`), but desktop CSS still imposes `height: 320vh` and a 100vh sticky panel (`site.css:99-105`). This leaves a static story occupying roughly 3.2 viewport heights. Reduced-motion CSS should collapse the scene as the mobile layout does.

5. **Horizontal rail lacks a keyboard affordance**  
   `.hscroll` is a non-focusable overflow container with no label or previous/next controls (`site.css:162-174`). Sighted keyboard users have no reliable explicit way to scroll it.

6. **Definition-list markup is invalid**  
   `specifications.html:43-62` needs a `<dl>` parent.

7. **Disclosure refinements**  
   The Menu button lacks `aria-controls`; there is no Escape/outside-close behavior. These are secondary to the missing no-JS fallback.

8. **Skip-link robustness**  
   The linked `<main>` is not explicitly focusable. Adding `tabindex="-1"` would make focus movement more consistent across browser/screen-reader combinations.

---

## 8. SEO and metadata

### Present and effective

Every page has:

- UTF-8 charset.
- Responsive viewport.
- Unique `<title>`.
- Unique meta description.
- Crawlable HTML copy and internal links.
- A single main heading.

See each page’s lines `2-8`.

### Missing for a public marketing launch

- Canonical URLs.
- Open Graph and Twitter card metadata.
- Social-sharing imagery.
- Favicon/icon declarations.
- `robots.txt` and `sitemap.xml`.
- SoftwareApplication/Product structured data.
- Deployment host/base-URL configuration.

These are not all mandatory for a small static site, and canonical URLs understandably require a deployment origin. However, social metadata and a favicon are the most visible readiness gaps.

The metadata baseline itself is good; there is no keyword stuffing or duplicated boilerplate description.

---

## 9. Dependencies, build, and run model

### Marketing website

- **Runtime dependencies:** None.
- **Build:** None required.
- **Assets:** Local HTML/CSS/JavaScript and inline SVG only.
- **Hosting:** Any static HTTP server can serve `website/` as its document root; relative URLs also make it portable beneath a subdirectory.
- **Website-specific documentation:** None.
- **Website-specific tests/linting/validation:** None.
- **Deployment configuration:** None.

The product launcher does **not** launch or serve this marketing site. `Start Firewall Guard.bat` delegates to `scripts/start.bat`, which starts the FastAPI backend and React/Vite dashboard (`scripts/start.bat:50-97`). The root README likewise documents the product, not the website.

### Product stack verified for comparison

- FastAPI/Uvicorn/psutil/Pydantic: `backend/requirements.txt:1-4`.
- React 18, Fluent UI v9, React Query, Vite: `frontend/package.json:6-24`.
- Vite on `127.0.0.1:5173`: `frontend/vite.config.ts:1`.
- Backend serving `frontend/dist`, when present: `backend/app/main.py:311-313`.

The website itself should not be described as requiring Node, Python, React, or FastAPI; those belong to the product.

---

## 10. Product claims versus verifiable implementation

### Well-supported claims

| Website claim | Supporting evidence |
|---|---|
| Loopback API and dashboard ports | `backend/config/settings.json:2-3`; `scripts/start.bat:51-54`, `:83-97`; `frontend/vite.config.ts:1` |
| React 18 and Fluent UI v9 | `frontend/package.json:10-16` |
| Separate Memory, GPU, and Disk pages | `frontend/src/App.tsx:42-47`; `frontend/src/pages/ResourcesPage.tsx:141-309` |
| Approximately 3-second system metrics and 4-second GPU refresh | `frontend/src/pages/MonitorPage.tsx:24-28`; `ResourcesPage.tsx:193-197` |
| DNS-cache names and `Resolve-DnsName` domain resolution | `backend/app/enrich.py:48-77`, `:110-148` |
| Optional five-minute elevated domain refresh | `backend/app/main.py:296-309` |
| FGF prefix, “Firewall Guard Fluent” group, block actions | `backend/app/firewall.py:4-5`, `:30-38` |
| Up to 50 batch targets | `backend/app/main.py:18`, `:25-29` |
| One elevated process for manual batch creation and per-rule verification | `backend/app/firewall.py:40-46`, `:91-105`, `:142-156` |
| Policy file is not a background enforcer | `docs/POLICIES.md:1-7`; policy API only reads the catalog at `backend/app/main.py:80-82` |
| Existing connections may survive new block rules | Consistent with Windows Firewall behavior and documented in `README.md:21-25` |
| No TLS/content inspection | Traffic implementation reads sockets, event metadata, DNS data, and optional TCP byte counts, not payload contents: `backend/app/traffic.py:109-198` |

“Live” traffic is implemented as near-live **three-second polling**, not a continuous push stream (`frontend/src/pages/TrafficPage.tsx:75-83`). That is reasonable, but “near-live” would be more precise.

### Material inconsistencies and unsupported absolutes

#### Critical: dry-run is not enabled in the current configuration

The site repeatedly says dry-run is the default:

- `website/index.html:221-225`
- `website/operations.html:59-67`
- `README.md:18-21`

But the current configuration contains:

```json
"dry_run": false
```

at `backend/config/settings.json:4`. `backend/app/main.py:13-17` reads that file, so its fallback `True` does not apply while this valid file exists.

**Required action:** Make the distributed configuration and actual first-run behavior match the safety claim before publishing it.

#### Critical: dry-run does not protect rule removal

The broad Operations wording says dry-run “does not change Windows Firewall.” However:

- Batch deletion has no dry-run branch: `backend/app/main.py:135-146`.
- Single deletion likewise immediately invokes removal: `main.py:147-151`.
- The UI nevertheless labels the action “Log dry-run removal” when dry mode is active: `frontend/src/components/dialogs.tsx:176-184`, `:208-212`.

Thus a user can see a dry-run removal label while the backend performs a live elevated deletion.

**Required action:** Either implement dry-run deletion consistently or explicitly scope all copy and UI to creation only. The former is safer and matches user expectations.

#### Critical: batch removal has an undefined-variable defect

`backend/app/firewall.py:159-168` returns a result using `items` at line 168, but no local `items` variable exists in `remove_rules_batch`.

The elevated script runs inside `_apply_batch` before that return (`firewall.py:119-139`). Consequently, static control flow indicates that rules may be removed and verified in PowerShell, followed by a Python `NameError`; `main.py:138-145` then returns an error without normal database status updates.

This undermines the website’s removal, verification, and per-item-result messaging.

#### High: “Only rules this console created” is stronger than enforcement

- Claims: `website/index.html:262-265`, `website/specifications.html:54`.
- Implementation: removal checks only whether a name starts with `FGF-`: `backend/app/firewall.py:56-59`, `:159-163`.

It does not verify the “Firewall Guard Fluent” group or database provenance. Normal UI selection may be limited to app records, but the backend guarantee is only prefix-based. The wording should be “FGF--prefixed rules,” or the implementation should enforce actual ownership.

#### High: process-protection claim is absolute but the guard is a short denylist

`website/specifications.html:61` says critical Windows processes and the console cannot be ended.

`backend/app/resources.py:5-23` protects:

- PID ≤ 4.
- The current backend process.
- A fixed list of process names.

That does not establish protection for every critical Windows process or every process comprising the console. Use “selected critical processes and the backend process,” or strengthen the guard.

#### Medium: outbound positioning omits the inbound option

`website/specifications.html:51` describes the managed workflow as outbound. The default is outbound, but the block dialog explicitly offers both Outbound and Inbound:

- `frontend/src/components/dialogs.tsx:75-89`, `:138-140`.
- Backend validation also accepts both: `backend/app/firewall.py:7-12`.

“Outbound by default, with optional inbound rules” is more accurate.

#### Medium: “Sort any column. Filter each column” is too absolute

The claim appears at `website/index.html:249-251`. The shared table deliberately supports unsortable and unfilterable columns:

- `frontend/src/components/DataTable.tsx:71`, `:106-107`, `:155-177`.
- Action columns use `filter: 'none'`, for example `ResourcesPage.tsx:64-72`.

“Sort and filter data columns” would match the implementation.

#### Medium: Node.js requirement needs a default-launcher qualification

`website/specifications.html:46` says Node is needed only to install or rebuild the dashboard. That is true only when using the optional built/single-process mode. The default launcher runs `npm run dev` every time at `scripts/start.bat:82-97`, requiring Node/npm even when dependencies are already installed.

#### Medium: “Python 3.11 or newer” is not fully matched by the launcher

The claim is at `website/specifications.html:45`. When the `py` launcher exists, `scripts/start.bat:20-25` specifically invokes `py -3.11`. A machine with only a newer Python installed through `py` may fail rather than fall back to that newer interpreter.

#### Low/uncertain: Windows 10 compatibility is not substantiated

`website/specifications.html:44` and `README.md:30` say Windows 10 works with reduced PowerShell behavior. The validation section only states verification on Windows 11 (`README.md:59-61`), and no compatibility matrix or Windows 10-specific fallback was identified. Treat this as unverified rather than disproven.

#### Additional domain-feature issue

The default cross-origin development setup permits only `GET`, `POST`, and `DELETE` in CORS (`backend/app/main.py:21`), while enabling/disabling a domain pattern uses `PATCH` (`frontend/src/api.ts:139`; `backend/app/main.py:248-253`). That toggle would be blocked by browser CORS through the default port-5173 setup, although same-origin built mode avoids the issue.

---

## 11. Website code quality

### Strengths

- Very small, understandable static implementation.
- Shared CSS variables and layout primitives.
- No external scripts, fonts, trackers, or client-side secrets.
- JavaScript is wrapped in an IIFE and checks for missing elements.
- Passive scroll listener and `IntersectionObserver` support.
- Illustrations use documentation-reserved `203.0.113.x` addresses.
- Safety limitations are integrated into the content rather than hidden.
- All repeated pages follow a predictable structure.

### Maintainability concerns

- Head, two navigation bars, and footer are duplicated across all four HTML files, creating drift risk.
- Numerous inline styles override reusable classes, particularly in `operations.html:44-55`, `:93-97`.
- Dark-section paragraph colors are repeatedly patched inline rather than handled by a reusable `.black .pair p` rule.
- The unused `.draw` hook suggests an incomplete animation.
- `--good` and `.cta.light` appear unused.
- No website README, HTML validation, accessibility checks, link checker, or browser smoke tests.
- No minification or cache-busting strategy; acceptable at this size, but worth documenting for deployment.

---

## 12. Recommended priorities and reusable patterns

### Before publication

1. Resolve the dry-run configuration and removal behavior; align all safety copy with tested behavior.
2. Fix and test batch removal, including database state after partial failure or UAC cancellation.
3. Correct claims about ownership, inbound rules, process protection, table behavior, Node, and Python.
4. Make content visible and navigation usable without JavaScript.
5. Repair the story controls’ semantics, target sizes, announcements, and reduced-motion layout.
6. Add a real acquisition path: source/download, documentation, release/version, and integrity information.
7. Add website-specific validation: internal-link check, HTML validation, keyboard tests, mobile browser smoke tests, and automated accessibility scanning.

### Patterns worth reusing

- **Four-stage narrative funnel:** Overview → Features → Specifications → Operations.
- **Token-driven static CSS:** color/type roles, `.chapter`, `.pair`, `.tile`, `.card`, `.wide`, and `.narrow`.
- **Dependency-free illustrations:** inline SVG with explicit “not live data” disclosure.
- **Claim-plus-caveat writing:** pair capabilities with limitations such as snapshot data, existing sessions, audit requirements, and third-party firewall interactions.
- **Operations runbook:** launch steps, ports, token handling, dry-run/live behavior, and troubleshooting in one place.
- **Responsive static-story fallback:** the existing mobile collapse is a good base; extend it to reduced-motion and no-JS modes.
- **Centralized evidence-driven specifications:** future specs should be generated or checked against product configuration to prevent drift such as `dry_run: false`.
- **Reusable templating:** retain the no-build deployment model if desired, but generate repeated head/navigation/footer markup from a small static template step rather than maintaining four copies manually.