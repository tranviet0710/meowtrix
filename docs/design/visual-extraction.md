## Visual Extraction & Design Tokens

### 1. Typography & Hierarchy

* **Font Style:** Thick, geometric, sans-serif typefaces (resembling Archivo Black, Impact, or Montserrat ExtraBold) used almost exclusively in **uppercase** for headings.
* **Text Transformation:** Headers, sub-headers, countdown indicators, labels, and button texts are heavily uppercase to maintain an aggressive, loud presence.
* **Letter Spacing:** Tight tracking on massive headers; tracking expanded slightly on smaller tags (e.g., `VIRTUAL • JUNE 24, 2026`).

### 2. The Color Palette

The palette relies on absolute high-contrast saturated fills paired with stark neutral backdrops.

* **Base Canvas Background:** A very soft, off-white/pale cream-pink hue (`#FFF5F5` or similar) to contrast against sharp white container fills.
* **Primary Brand Color:** Energetic Bright Yellow (`#FFDE4D` / `#FFE600`) used for main hero banners, footer zones, and prominent emphasis components.
* **Accent Blocks & Section Headers:**
* **Vivid Orange (`#FF9F1C`):** Used for "Timeline" headers, "Event Details", and critical actionable states.
* **Vivid Pink (`#FF6B97`):** Used for "Why Join" or progress trackers.
* **Bright Mint Green (`#51E5A5` / `#60EFF1`):** Used for verified states (`OK`, `ONGOING`, `YOUR IDEA`).
* **Discord/Community Purple-Blue (`#5865F2`):** Reserved for community call-to-actions.
* **Gradients:** Occasional loud linear gradients (Pink to Purple) used for eye-catching banners or specific sponsor slots.



### 3. Borders, Grids, & Shadows (The Core Neo-Brutalist DNA)

* **Borders:** **Thick, solid black borders** (`border: 3px solid #000000` or `4px`). No soft borders or low-contrast separators are allowed. Every card, button, tag, and grid divider is strictly outlined.
* **Border Radius:** Mostly completely sharp ($0\text{px}$) or very minimal rounding ($4\text{px}$ to $8\text{px}$) on buttons, badges, and user avatars to maintain a structural box layout.
* **Shadows (The "Hard" Drop Shadow):** Zero blur radius. Shadows are achieved using an offset with $100\%$ opacity.
* *CSS Example:* `box-shadow: 4px 4px 0px #000000;` or `5px 5px 0px #000000;`
* When a button is hovered or active, it physically shifts downward to "press" into the shadow space (`transform: translate(4px, 4px); box-shadow: 0px 0px 0px #000000;`).


* **Layout Structure (Bento Grid / Modular Blocks):**
* Seen clearly in **image1.jpg** ("Team Rules") and **image3.jpg** ("Event Details"), components are stacked directly into side-by-side or stacked modular boxes sharing a single combined border wall or separated cleanly by thick gaps.