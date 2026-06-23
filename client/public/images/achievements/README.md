# Achievement Artwork Manifest

Generated with the built-in Image 2 workflow on 2026-06-19. Final assets are 512x512 transparent WebP files. `achievement-contact-sheet.webp` is the visual QA index.

## Prompt System

All assets use the same production prompt: front-facing premium semi-3D cloisonne enamel relief; simplified geometric forms; strong silhouette readable at 32px; ocean blue, cyan, rainforest green, snow white, and restrained warm gold; one centered emblem with generous padding; no text, letters, numbers, watermark, emoji styling, outer medal base, or cast shadow. Sources were generated on a flat `#ff00ff` chroma background, then locally keyed, despilled, resized, and visually checked.

## Mapping

- Growth series: `series-province`, `series-city`, `series-attraction`, `series-collector`.
- Skill categories 1-11: `skill-humanities`, `skill-water`, `skill-mountain`, `skill-geology`, `skill-forest`, `skill-urban`, `skill-pilgrimage`, `skill-play`, `skill-ancient-town`, `skill-heritage`, `skill-museum`.
- Special and personality achievements: `special-{achievementId}` for IDs 101, 102, 103, 104, 105, 107, 108, 109, 110, 111, and 120-126.

The server catalog owns the runtime mapping through `artwork_path`; level material, locked state, secret state, and equipped state remain code-rendered UI concerns.
