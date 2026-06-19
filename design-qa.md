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
