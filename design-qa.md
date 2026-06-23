# Design QA: 找回我的足迹 - 地图陪伴

- Source visual truth: `/Users/mint/.codex/generated_images/019ed911-769f-7db2-b6d7-18dd649e21e7/exec-f5d26ddb-9650-4a87-b15e-7d9447bdab76.png`
- Implementation target: `http://127.0.0.1:5173/recall`
- Implementation screenshot before density pass: `/var/folders/0l/p6whhrt95p1119flyp3kwfxr0000gn/T/codex-clipboard-89184ad5-05b8-4797-832b-0f6693332655.png`
- Intended viewport: 390 x 844 mobile
- State: intro, city selection, attraction selection, and completion flow

**Full-view comparison evidence**

The source visual and the user-provided implementation screenshot were opened. The screenshot confirmed excessive intro copy density and oversized result metric sections. After the density patch, the app reload redirected to login because the preview session was no longer authenticated, so a post-change implementation screenshot could not be captured.

**Focused region comparison evidence**

The pre-change screenshot was sufficient to target the intro copy block and result metric sections. Post-change crops still require capture after authentication.

**Findings**

- [P1] Updated density pass has not been visually verified after authentication expired.
  Location: all recall routes.
  Evidence: the pre-change screenshot is available; reloading the updated implementation redirected to login before a post-change capture.
  Impact: overflow, image crop, sticky-bar overlap, and small-screen density cannot be ruled out.
  Fix: capture all four routes at 390 x 844 and compare them with the source board.

**Patches made**

- Replaced the two-step bar with a four-node journey progress indicator.
- Added live city and attraction counts to the progress route.
- Reused existing brand watercolor and logo assets on intro and completion states.
- Strengthened selected states and contextual sticky actions.
- Made map review the primary completion action.
- Added responsive reductions for narrow mobile widths.

**Implementation checklist**

- Capture intro at 390 x 844.
- Capture city selection with at least one selected city.
- Capture attraction selection with at least two selected attractions.
- Capture completion with populated metrics.
- Fix any P0/P1/P2 visual differences and rerun QA.

final result: accepted (2026-06-18)

---

# V0.2.2 Design QA

## Comparison target

- Source: `ChatGPT Image 2026年6月18日 21_10_43 (1).png` and `ChatGPT Image 2026年6月18日 21_10_44 (2).png`.
- Implementation: `/province/29` and `/province/29/cities/311` at a 471 x 834 mobile viewport.
- State: authenticated admin test account, Qinghai province, Xining city, two recorded attractions.

## Result

No P0, P1, or P2 fidelity issues remain.

- Typography: title, statistic, section, control, and metadata hierarchy match the source's compact mobile scale.
- Spacing and layout: hero, overlapping statistic cards, filters, city cards, grouped attractions, and fixed action bar follow the source composition without horizontal overflow.
- Colors and tokens: cyan-blue hero, teal actions, green completed state, pale blue guidance surfaces, and white translucent cards are consistent with the target.
- Image quality: the Qinghai hero is a project-local high-resolution image with a responsive crop; thumbnails use the same coherent regional art direction.
- Copy and content: labels use real Qinghai data and preserve the source information architecture.
- Icons: controls use the existing Lucide icon family with consistent sizing and alignment.
- Interaction states: search, status/category filters, grouped expansion, repeated attraction selection, disabled/enabled confirmation, date maximum, success toast, and progress refresh were exercised.
- Responsiveness: verified at 390 x 844, 471 x 834, and 1280 x 800; desktop document width equals viewport width.
- Accessibility: semantic buttons, labels, checkboxes, focusable controls, and reduced-motion handling are present.

Focused comparison was performed on the hero/stat-card boundary, city-card density, attraction rows, and fixed action bar because these surfaces carry the page's key fidelity risk.

Remaining P3 note: provinces without a dedicated hero asset intentionally fall back to the existing travel image until the product gains a broader regional image library.

## Density refinement

- Source: user annotations captured at 636 x 1376 and 654 x 1382.
- Province page: search and both filters now share one row across all mobile widths; elastic search sizing and compact select spacing preserve labels and arrows down to 320px.
- City page: search, status, and category share one compact row across mobile widths.
- Evidence: before/after composites were reviewed for both pages at matching viewport sizes.
- Responsiveness: verified at 320px, 390px, 636px, and 654px with document width equal to viewport width and no clipped controls.
- Result: the first city cards appear about 80px earlier and the first attraction group appears about 120px earlier at the annotated viewport sizes.

## Final mobile regression fixes

- Replaced native selects with a shared in-app menu so mobile browsers cannot open detached system popovers over the summary cards.
- Long category menus are viewport-constrained and scroll internally above the fixed lighting action bar.
- Removed nested document scrolling from the province/city flow and reset the content scroller on route changes.
- Verified the city page at the bottom of the list with three selected attractions: the last group retains a compact panel inset before the fixed action bar with no blank viewport.

## City sorting refinement

- Smart sorting is the default and pins the provincial capital before progress and attraction-count ranking.
- Attraction count sorting was verified in descending order.
- City name sorting was verified with the Chinese pinyin collation order.
- Shanxi verification confirmed Taiyuan remains first even when other cities have higher lighting progress.

final result: passed

---

# V0.4.1 移动端验收修复 Design QA

- Source visual truth: `/var/folders/0l/p6whhrt95p1119flyp3kwfxr0000gn/T/codex-clipboard-2aba50df-77ef-453f-ba67-4d7aaf9524a0.png`
- Implementation target: `http://localhost:5173`
- Implementation screenshot: `/private/tmp/trip-recall-restored.jpg`
- Viewport: 574 x 891 Safari mobile-width window; responsive rules cover the 393px iPhone 15 Pro CSS viewport.
- State: authenticated map, selected province, recommendation drawer, achievement wall, city attraction list, favorite active states, and restored recall draft.

**Full-view comparison evidence**

The source failure state and the restored confirmation screen were opened in the same comparison pass. After a full reload, the implementation retains the selected city and returns to the attraction list instead of rendering the source's “还没有选择城市” fallback.

**Focused region comparison evidence**

- Map: the recommendation trigger sits directly above the complete four-metric strip without covering its icons or values; the drawer opens and closes cleanly.
- Province focus: 河北省 is centered from its geometry bounds and the solid guidance card remains sharp above the map.
- Achievement wall: category names appear once in the tabs with compact counts; the content panel begins directly with badge series.
- Favorites: city favorite remains in the hero's top-right safe area; attraction and city active states use a solid warm fill and white heart.

**Findings**

No actionable P0, P1, or P2 issues remain.

- Typography: existing Chinese system typography, weights, truncation, and compact data labels remain consistent and legible.
- Spacing and layout: the map trigger, statistic strip, bottom navigation, city hero, overlapping statistic cards, and fixed lighting bar do not collide at the tested mobile width.
- Colors and tokens: existing cyan, mint, deep-blue, and warm favorite-state colors are preserved with sufficient state contrast.
- Image quality: existing project hero and badge assets remain sharp; no replacement or placeholder assets were introduced.
- Copy and content: recommendation, category-count, favorite, recall-progress, and empty-state labels remain sourced from existing product data.
- Behavior and accessibility: dialog semantics, Escape close, overlay close, focus target, tab roles, `aria-pressed`, reduced motion, and reload restoration were exercised.

**Patches made**

- Restored the map metrics and replaced the always-open recommendation dock with a compact trigger and bottom sheet.
- Centered province geometry with responsive bounds fitting and removed blur from the province action card.
- Removed repeated achievement category headings and added tab counts.
- Added explicit active favorite styles and moved the mobile city favorite above the statistic-card overlap.
- Added versioned, user-scoped recall draft persistence with hydration gating and invalid-data fallback.

**Verification**

- Selected a city and attraction, reloaded the confirmation route, and verified both selections remained.
- Removed the test city afterward and verified the draft returned to an empty state.
- Client build and ESLint, server build and five server tests, and `git diff --check` passed.

final result: passed

---

# V0.3.3.1 徽章墙缺陷修复 QA

- Source visual truth: `/var/folders/0l/p6whhrt95p1119flyp3kwfxr0000gn/T/codex-clipboard-fb1ceb51-3c5c-47b6-81a3-4fc5003077f2.png`
- Implementation target: `http://127.0.0.1:5173/achievements`
- Scope: 技能树详情条件、单级徽章名称、独立徽章排序、普通彩蛋中文条件

**Findings and patches**

- 技能树条件改由服务端结合分类已审核景区总数和等级阈值生成，11 个分类、每类 10 级均返回精确中文数量。
- 单级旅行人格与彩蛋卡片不再渲染外层系列标题，名称仅由 `AchievementBadge` 展示一次；多级系列副标题保持不变。
- 旅行人格和彩蛋成就分别按已点亮优先、同状态目录 ID 升序排列；等级型系列仍固定按 Lv.1 至 Lv.N 排列。
- 10 个普通彩蛋内部规则码集中映射为中文获得条件，未知规则统一回退为中文通用条件。
- 未解锁普通彩蛋继续返回 `???` 和保密提示，不泄露名称、图腾或真实条件。

**Verification**

- 静态数据验证覆盖 110 条技能树等级条件，未发现空值、英文规则码或数量不匹配。
- 10 个普通彩蛋规则全部命中中文映射，未知规则回退为 `完成对应彩蛋条件`。
- 应用内实测确认技能树“游者”详情显示 `点亮13个人文古迹景区`，且保留 10 级圆点结构。
- 后续应用内浏览器操作被本地地址安全策略拒绝，因此旅行人格、彩蛋展开与详情的最终点击复验未继续执行；代码路径、排序结果和数据输出已完成静态验证。
- Client TypeScript/Vite build、Server TypeScript build、ESLint 和 `git diff --check` 通过。

final result: passed with browser limitation noted

---

# V0.3 Recall Confirmation Toolbar QA

- Source visual truth: `/Users/mint/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_1p8zcn48pbs411_84fd/temp/InputTemp/c7b82803-5888-4fbb-a650-05de8f03f12e.png`
- Implementation target: `http://localhost:5173/recall/confirm`
- Implementation screenshot: blocked; the in-app browser screenshot command timed out repeatedly.
- Viewport: 390 x 844 mobile
- State: Shanghai and Hangzhou selected; Hangzhou active; 4A filter active.

**Full-view comparison evidence**

The source screenshot was opened at original resolution. The implementation was inspected in the in-app browser through its rendered DOM and measured at the target viewport, but a post-change screenshot could not be captured for a side-by-side image comparison.

**Focused region comparison evidence**

- Combined city and filter panel: 358 x 149px.
- City tabs: 332 x 46px.
- Search and two-select toolbar: 328 x 36px, matching the existing attraction-lighting toolbar height.
- First attraction card starts 10px below the combined panel.
- Document width remains within the 390px viewport with no horizontal overflow.

**Findings**

- [P1] Pixel-level visual comparison remains unavailable.
  Location: recall confirmation city/filter panel.
  Evidence: source image is available, but all in-app browser screenshot attempts timed out.
  Impact: rendered typography and subtle spacing cannot receive the required image-to-image sign-off.
  Fix: capture the current in-app browser view and compare it beside the source screenshot.

**Patches made**

- Combined the city switcher and filters into one compact card.
- Reused the attraction-lighting page's one-row search/select toolbar.
- Replaced the three large level pills and native category select with shared `RegionSelect` controls.
- Reduced city tab height from 54px to 42px.
- Removed obsolete confirmation-page filter styles.

**Implementation checklist**

- Search was exercised with a single-result query.
- Level selection was changed to 4A and its empty state verified.
- City switching was exercised and its selected state verified.
- Client build, server build, lint, and whitespace checks passed.
- Capture and compare a post-change screenshot before visual sign-off.

final result: blocked

---

# V0.4.2 首次点亮与徽章庆祝体验 QA

- Source visual truth: `/Users/mint/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_1p8zcn48pbs411_84fd/temp/RWTemp/2026-06/9ac97b8b7e7bf26efd24106b4a8c7c14/64acaa736ed592a9783ebe2a375a84d3.jpg`
- Implementation target: `http://localhost:5174/recall`, `http://localhost:5174/achievements`
- Implementation screenshot: unavailable; the application browser runtime could not initialize in this environment.
- Intended viewport: 390 x 844 mobile
- State: city selection, attraction selection with collapsed filters, time disclosure, achievement library, single and multiple badge celebration

**Full-view comparison evidence**

The NetEase reference was opened at original resolution. It establishes a dark full-screen celebration surface, one dominant badge artwork, short congratulatory copy, and two clear actions. A matching implementation screenshot could not be captured, so image-to-image comparison is incomplete.

**Focused region comparison evidence**

No implementation crop was available. Source review focused on the badge stage, title/copy hierarchy, close control, and dual-action footer.

**Findings**

- [P1] Post-change visual capture is unavailable.
  Location: recall flow, achievement library, and achievement celebration overlay.
  Evidence: source image opened successfully; local frontend and API both return HTTP 200, but the application browser runtime failed before a rendered screenshot could be captured.
  Impact: typography, spacing, badge crop, sticky-action overlap, and exact 390 x 844 behavior cannot receive visual sign-off.
  Fix: capture the five target states at 390 x 844 and compare the celebration state beside the reference.

**Patches made**

- Reduced recall from four stations to three stages and routed `/recall` directly to city selection.
- Added compact first-use guidance, optional search/filter disclosure, and optional unified-time disclosure.
- Replaced the achievement center with a compact collection summary and direct three-category badge library.
- Rebuilt achievement unlock feedback as a full-screen, artwork-led celebration with multi-badge navigation, focus containment, scroll lock, keyboard controls, and reduced-motion support.
- Connected the celebration to recall, city lighting, and personality unlock sources and added persisted funnel events.

**Verification**

- Client build and ESLint passed.
- Server build and all five server tests passed.
- `GET /api/recall/guide`, `/api/recall/cities/hot`, `/api/achievements/mine`, and `/api/categories` returned HTTP 200.
- `git diff --check` passed.

final result: blocked

---

# V0.3.2 徽章墙 Design QA

- Source visual truth: `/var/folders/0l/p6whhrt95p1119flyp3kwfxr0000gn/T/codex-clipboard-46afc88f-5a7e-4d1b-aae1-dbdf849ecedc.png`, `/var/folders/0l/p6whhrt95p1119flyp3kwfxr0000gn/T/codex-clipboard-650eeba7-108d-47e3-a528-9a644b3d7018.png`, and `/var/folders/0l/p6whhrt95p1119flyp3kwfxr0000gn/T/codex-clipboard-71ef07f9-dc29-445e-b551-54ea3c27ed5b.png`
- Implementation target: `http://127.0.0.1:5173/achievements`
- Implementation screenshots: `/private/tmp/achievement-v032-wall-375.png`, `/private/tmp/achievement-v032-detail-375.png`, `/private/tmp/achievement-v032-wall-622.png`, and `/private/tmp/achievement-v032-detail-622.png`
- Comparison evidence: `/private/tmp/achievement-v032-wall-comparison.png` and `/private/tmp/achievement-v032-detail-comparison.png`
- Viewports: 375 x 812, 622 x 1360, 636 x 1000, 768 x 1000, and 1280 x 900
- State: authenticated badge wall; footprint, skill, Easter egg, unlocked detail, and locked secret detail states

**Full-view comparison evidence**

The source and implementation were placed side by side at the screenshot-matched width. The implementation removes the round and polygon artwork bases, restores the three category tabs, uses three columns below 768px and four columns from 768px, and replaces the overlapping arrow modal with an isolated scroll-snap detail layout.

**Focused region comparison evidence**

- Detail artwork, dots, position label, name, condition, equip action, and close control were inspected together at 375px and 622px.
- The measured artwork-to-dot gap is 16px; the close button does not intersect the artwork; the document width equals the viewport at every tested breakpoint.
- Initial selection opens directly on the clicked level without a level-one flash.

**Findings**

No actionable P0, P1, or P2 differences remain.

- Typography: system Chinese typography remains consistent with the existing product; hierarchy and wrapping remain legible at all tested widths.
- Spacing and layout: three/four-column grids, tablet modal width, safe close area, and fixed vertical slide regions have no overlap or horizontal overflow.
- Colors and tokens: the existing blue-cyan-green palette is preserved while artwork backgrounds and material rings are removed.
- Image quality: transparent Image 2 artwork is rendered directly with only a subtle drop shadow; no emoji or CSS-drawn substitutes are used.
- Copy and content: level names and conditions sync after dots, keyboard navigation, mouse dragging, and scroll snapping. Locked Easter eggs expose neither name nor condition.
- Accessibility: tab roles, dialog semantics, keyboard arrows, Escape, focus outline, dot labels, reduced motion, and touch scrolling remain available.

**Patches made**

- Restored the three secondary wall tabs and current-category panel.
- Added three-column mobile and four-column desktop layouts.
- Removed artwork containers, polygon clipping, gradients, borders, and material rings.
- Replaced the reused wall badge in the dialog with dedicated scroll-snap slides.
- Added synchronized dots, position text, initial-level positioning, pointer dragging, touch/trackpad scrolling, and keyboard navigation.
- Hid locked Easter egg series titles and detail content.

**Verification**

- Province 5 levels, city 6 levels, attraction 10 levels, skill 10 levels, and collector 5 levels.
- Dot click, ArrowLeft/ArrowRight, mouse drag, category tabs, initial positioning, and secret-state masking passed.
- Client TypeScript/Vite build, ESLint, and `git diff --check` passed.

final result: passed

---

# V0.3.3 徽章页信息密度 Design QA

- Source visual truth: `/var/folders/0l/p6whhrt95p1119flyp3kwfxr0000gn/T/codex-clipboard-d13e0c7f-37f3-4806-8dc9-c6b6202a8756.png` and `/var/folders/0l/p6whhrt95p1119flyp3kwfxr0000gn/T/codex-clipboard-d1ea1002-27b3-4743-94f2-9329a28eab7e.png`
- Implementation target: `http://127.0.0.1:5173/achievements`
- Implementation screenshots: `/private/tmp/achievement-v033-center-375.png`, `/private/tmp/achievement-v033-easter-375.png`, `/private/tmp/achievement-v033-center-670.png`, and `/private/tmp/achievement-v033-detail-688.png`
- Comparison evidence: `/private/tmp/achievement-v033-center-comparison.png` and `/private/tmp/achievement-v033-detail-comparison.png`
- Viewports: 375 x 812, 670 x 1470, 690 x 1200, 768 x 1000, and 1280 x 900
- State: achievement center, default Easter grouping, alternate expanded grouping, and unlocked collector detail

**Full-view comparison evidence**

The screenshot-matched comparisons confirm that the former segmented capsule is replaced by a 41px underline navigation, the overview and next-goal cards are consolidated into one journey cockpit, and the duplicate visible level labels are removed from the detail dialog.

**Focused region comparison evidence**

- The achievement center was inspected at 375px and at the source screenshot width. The cockpit is approximately 308px high on mobile and the compact queue contains three recommendation rows.
- The Easter panel was inspected with collector and personality expanded and ordinary Easter achievements collapsed, then with the alternate toggle state.
- The detail dialog was inspected at 375px and 688px; artwork, dots, name, condition, close control, and equip action do not overlap.

**Findings**

No actionable P0, P1, or P2 differences remain.

- Typography: duplicate level emphasis is removed; name and condition now form the only text hierarchy in the slide.
- Spacing and layout: primary navigation height and section gaps are reduced; cockpit and compact task rows remove the prior stacked-card whitespace.
- Colors and tokens: the existing deep blue, cyan, and exploration green system is preserved.
- Image quality: existing transparent Image 2 artwork remains unmasked and sharp with no new placeholder assets.
- Copy and content: next-goal data, recent unlock, counts, conditions, and recommendation actions remain sourced from existing APIs.
- Behavior and accessibility: three controlled Easter groups expose counts and `aria-expanded`; dots retain accessible level labels; keyboard, mouse, touch, Escape, and equip behavior remain intact.
- Responsiveness: mobile uses three badge columns, 768px and desktop use four, and document width equals viewport width at all tested sizes.

**Patches made**

- Added controlled collector, travel personality, and Easter achievement groups with privacy-safe labels.
- Removed both visible level text rows from achievement detail slides.
- Replaced the main capsule with compact underline tabs and adjusted the secondary sticky offset.
- Added the journey cockpit and a compact recommendation variant without changing the recall result page default.

**Verification**

- Default groups: collector open, travel personality open, Easter achievements closed.
- Toggle state, group counts, locked-name privacy, dot click, keyboard switching, and initial selected level passed.
- Main and secondary sticky navigation meet without overlap at their pinned positions.
- Client TypeScript/Vite build, ESLint, and `git diff --check` passed.

final result: passed
