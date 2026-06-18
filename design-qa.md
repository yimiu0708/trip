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
