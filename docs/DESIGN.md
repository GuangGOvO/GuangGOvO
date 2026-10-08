# Design system

## Visual direction

The profile uses a restrained terminal palette: dark panels, thin GitHub-style borders, monospace labels, and green or blue accents. Cards use the same corner radius, border color, and spacing. No badge wall or decorative tables are used.

## Color tokens

The values live in `profile.config.json` under `brand.colors`. Edit the JSON and run `npm run generate` to rebuild the assets.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| Background | `#0D1117` | `#FFFFFF` | Outer canvas |
| Panel | `#161B22` | `#F6F8FA` | Cards and controls |
| Border | `#30363D` | `#D0D7DE` | Card outlines and separators |
| Text | `#E6EDF3` | `#1F2328` | Primary text |
| Muted | `#8B949E` | `#59636E` | Labels and helper text |
| Green | `#3FB950` | `#1A7F37` | Terminal prompt and success state |
| Blue | `#58A6FF` | `#0969DA` | Links and secondary emphasis |
| Amber | `#D29922` | `#9A6700` | Missing or stale state |

The README uses `<picture>` with a dark-mode source and a light-mode fallback. Hero art also has static variants selected when the viewer requests reduced motion. A normal `<img>` remains as the fallback if a host ignores a `<source>` element.

## SVG rules

- Every image is a standalone SVG with an explicit `viewBox`, title, and description where useful.
- Fonts use system monospace fallbacks; remote fonts are never requested.
- User/config/API text is XML-escaped, length-bounded, and inserted into text nodes only.
- The output is assembled from local shapes and text. Scripts, `<foreignObject>`, remote images, event handlers, and user-provided SVG fragments are rejected.
- Images use a 960-pixel canvas and scale through their `viewBox`; project lists and technology chips grow vertically instead of forcing a narrow Markdown table.
- README image URLs carry a SHA-256 content version so refreshed SVGs do not remain hidden behind a cached image URL.
- `assets/generated/contribution-grid-*.svg` is the static contribution fallback. `assets/generated/contribution-snake-*.svg` begins as a valid setup illustration and is replaced only after a successful snake generation.

## Motion

The hero reveals its configured line through a declarative SVG clip animation and blinks one low-contrast cursor. The logo, status light, and statistics cards use small opacity pulses. There is no JavaScript or interaction in the README. Static copies are included for reduced-motion selection and for environments that do not play SVG animation.

The XML and local browser formats are validated here. GitHub's production Markdown image proxy can apply host-specific sanitization, and this repository has no remote profile repository yet, so final animation playback in an actual GitHub profile remains unverified until deployment.

## Typography and layout

SVG labels use `ui-monospace`, `SFMono-Regular`, Consolas, and generic monospace fallbacks. Markdown provides the document hierarchy; graphics carry only compact visual summaries. All sections remain usable when images fail because the README includes text and links around the generated images.
