/*

Color Scheme Manager — create, save and apply full color schemes on the fly.

Opens a docked side panel listing your saved schemes. Each scheme holds three
colors: stroke, fill and canvas background. Click a scheme's name to apply it:

- If elements are selected, their stroke and fill are recolored.
- If nothing is selected, the active stroke/fill is set so the NEXT elements you
  draw use the scheme.
- Either way, the canvas background is repainted to the scheme's background.
- Applying (or the "Load all → picker" button) loads the colors of ALL your
  saved schemes into Excalidraw's NATIVE color picker — so every scheme's
  stroke / fill / background shows up as an option in the picker grid, each with
  its own lightness shades. "Reset picker" restores Excalidraw's defaults.

Click an individual swatch to change just that color (opens Excalidraw's native
palette). Use "+ New scheme" to define one from scratch, or "Save selection" to
capture the colors of the currently selected element. Schemes persist across
sessions via the plugin's script settings.

Requires Excalidraw plugin 2.19.1 or higher.

```javascript
*/

if (!ea.verifyMinimumPluginVersion || !ea.verifyMinimumPluginVersion("2.19.1")) {
  new Notice("Please update the Excalidraw Plugin to version 2.19.1 or higher.");
  return;
}

// If a side panel for this script is already open, just reveal it.
const existingTab = ea.checkForActiveSidepanelTabForScript();
if (existingTab) {
  const hostEA = existingTab.getHostEA();
  if (hostEA && hostEA !== ea) {
    hostEA.setView(ea.targetView);
    existingTab.open();
    return;
  }
}

// Shown by the ℹ️ button at the top of the side panel.
const ABOUT = `
**Color Scheme Manager** swaps the Excalidraw **Stroke** and **Background/Fill**
colour palettes between named, categorized themes — on the fly.

- **Click a scheme's name** to apply it. With elements selected it recolours their
  stroke & fill; with nothing selected it sets the active colour for the next
  elements you draw. Either way the native picker (quick-pick rows + the extended
  3×5 grid, each swatch with shades) is refreshed with that scheme's family.
- The **canvas background is never changed** — it stays white.
- Use the **Category** dropdown to filter the library.
- **+ New scheme** builds a full palette from two colours; **Import** turns pasted
  hex codes (e.g. a Paletton export) into a scheme/theme.
- **Save selection** captures the colours of a selected element.
- **Load all → picker** loads every scheme's colours at once; **Reset picker** /
  the **↺ Default** row restore Excalidraw's defaults.
- Reopen the colour picker to see a refreshed palette (Excalidraw caches it).
`;

// ------------------------------------------------------------------
// Persistence
// ------------------------------------------------------------------
const SETTINGS_KEY = "Saved Schemes (JSON)";

// Preferred ordering of categories in the dropdown (anything else appended).
const CATEGORY_ORDER = [
  "Cloud Providers",
  "Code Editors",
  "Tech Brands",
  "Design Systems",
  "Nature",
  "Solids",
  "Vibrant",
  "Minimal",
  "Custom",
];

// The catalog. Every entry has a category and 10 `accents` (the source for the
// full 15-swatch palette). stroke/fill are just the row's preview swatches; the
// canvas background is always white.
const DEFAULT_SCHEMES = [
  // --- Cloud Providers ---
  { name: "Oracle Redwood", category: "Cloud Providers", stroke: "#C74634", fill: "#1B8271", bg: "#ffffff", accents: ["#C74634","#A8392B","#E07A6E","#F1B13F","#7A2E20","#1B8271","#3FA98E","#0F5E50","#2E7D5B","#3C4545"] },
  { name: "AWS",            category: "Cloud Providers", stroke: "#FF9900", fill: "#232F3E", bg: "#ffffff", accents: ["#FF9900","#EC7211","#FFAC31","#232F3E","#146EB4","#1A476F","#2E73B8","#D45B07","#37475A","#879196"] },
  { name: "Microsoft Azure",category: "Cloud Providers", stroke: "#0078D4", fill: "#50E6FF", bg: "#ffffff", accents: ["#0078D4","#50E6FF","#0063B1","#243A5E","#00BCF2","#005BA1","#40A9FF","#6CB8F6","#1B3A57","#8AC7FF"] },
  { name: "Google Cloud",   category: "Cloud Providers", stroke: "#4285F4", fill: "#34A853", bg: "#ffffff", accents: ["#4285F4","#EA4335","#FBBC04","#34A853","#1A73E8","#D93025","#F9AB00","#188038","#1967D2","#5BB974"] },
  { name: "IBM Cloud",      category: "Cloud Providers", stroke: "#0F62FE", fill: "#78A9FF", bg: "#ffffff", accents: ["#0F62FE","#4589FF","#001D6C","#0043CE","#78A9FF","#002D9C","#A6C8FF","#001141","#0353E9","#393939"] },
  { name: "DigitalOcean",   category: "Cloud Providers", stroke: "#0069FF", fill: "#3D9BFF", bg: "#ffffff", accents: ["#0069FF","#0080FF","#0061EB","#031B4E","#3D9BFF","#004FC4","#66B3FF","#022B6B","#1A8CFF","#13294B"] },
  { name: "Alibaba Cloud",  category: "Cloud Providers", stroke: "#FF6A00", fill: "#FFA866", bg: "#ffffff", accents: ["#FF6A00","#FF8C33","#E85D00","#1F1F1F","#FFA866","#C24A00","#FFB680","#3C3C3C","#FF7A1A","#5C5C5C"] },

  // --- Code Editors ---
  { name: "Nord",        category: "Code Editors", stroke: "#5E81AC", fill: "#88C0D0", bg: "#ffffff", accents: ["#5E81AC","#81A1C1","#88C0D0","#8FBCBB","#A3BE8C","#B48EAD","#BF616A","#D08770","#EBCB8B","#4C566A"] },
  { name: "Dracula",     category: "Code Editors", stroke: "#BD93F9", fill: "#8BE9FD", bg: "#ffffff", accents: ["#BD93F9","#FF79C6","#8BE9FD","#50FA7B","#FFB86C","#FF5555","#F1FA8C","#6272A4","#44475A","#282A36"] },
  { name: "Solarized",   category: "Code Editors", stroke: "#268BD2", fill: "#2AA198", bg: "#ffffff", accents: ["#268BD2","#2AA198","#859900","#B58900","#CB4B16","#DC322F","#D33682","#6C71C4","#586E75","#657B83"] },
  { name: "Monokai",     category: "Code Editors", stroke: "#F92672", fill: "#A6E22E", bg: "#ffffff", accents: ["#F92672","#A6E22E","#FD971F","#66D9EF","#AE81FF","#E6DB74","#75715E","#F8F8F2","#272822","#49483E"] },
  { name: "Gruvbox",     category: "Code Editors", stroke: "#FB4934", fill: "#B8BB26", bg: "#ffffff", accents: ["#FB4934","#B8BB26","#FABD2F","#83A598","#D3869B","#8EC07C","#FE8019","#928374","#282828","#EBDBB2"] },
  { name: "One Dark",    category: "Code Editors", stroke: "#61AFEF", fill: "#98C379", bg: "#ffffff", accents: ["#61AFEF","#E06C75","#98C379","#E5C07B","#C678DD","#56B6C2","#ABB2BF","#5C6370","#282C34","#D19A66"] },
  { name: "Tokyo Night", category: "Code Editors", stroke: "#7AA2F7", fill: "#BB9AF7", bg: "#ffffff", accents: ["#7AA2F7","#BB9AF7","#7DCFFF","#9ECE6A","#E0AF68","#F7768E","#2AC3DE","#73DACA","#1A1B26","#A9B1D6"] },
  { name: "Catppuccin",  category: "Code Editors", stroke: "#CBA6F7", fill: "#89B4FA", bg: "#ffffff", accents: ["#CBA6F7","#F5C2E7","#89B4FA","#94E2D5","#A6E3A1","#F9E2AF","#FAB387","#EBA0AC","#1E1E2E","#CDD6F4"] },
  { name: "Ayu",         category: "Code Editors", stroke: "#FF8F40", fill: "#59C2FF", bg: "#ffffff", accents: ["#FF8F40","#FFB454","#59C2FF","#AAD94C","#D2A6FF","#F07178","#39BAE6","#95E6CB","#0B0E14","#BFBDB6"] },

  // --- Tech Brands ---
  { name: "GitHub",   category: "Tech Brands", stroke: "#24292F", fill: "#0969DA", bg: "#ffffff", accents: ["#0969DA","#1F883D","#CF222E","#BF8700","#8250DF","#24292F","#0D1117","#57606A","#2DA44E","#BC4C00"] },
  { name: "Slack",    category: "Tech Brands", stroke: "#4A154B", fill: "#36C5F0", bg: "#ffffff", accents: ["#4A154B","#36C5F0","#2EB67D","#ECB22E","#E01E5A","#611F69","#1264A3","#350D36","#1D1C1D","#7C2855"] },
  { name: "Spotify",  category: "Tech Brands", stroke: "#1DB954", fill: "#1ED760", bg: "#ffffff", accents: ["#1DB954","#1ED760","#1AA34A","#121212","#535353","#2EBD59","#404040","#191414","#7F7F7F","#B3B3B3"] },
  { name: "Discord",  category: "Tech Brands", stroke: "#5865F2", fill: "#57F287", bg: "#ffffff", accents: ["#5865F2","#57F287","#FEE75C","#EB459E","#ED4245","#404EED","#3BA55D","#2C2F33","#23272A","#99AAB5"] },
  { name: "Stripe",   category: "Tech Brands", stroke: "#635BFF", fill: "#00D4FF", bg: "#ffffff", accents: ["#635BFF","#00D4FF","#0A2540","#7A73FF","#11EFE3","#425466","#96A0B5","#3A3D5C","#1A1F36","#8C9EFF"] },
  { name: "Figma",    category: "Tech Brands", stroke: "#F24E1E", fill: "#A259FF", bg: "#ffffff", accents: ["#F24E1E","#A259FF","#1ABCFE","#0ACF83","#FF7262","#7B61FF","#0FA958","#2C2C2C","#1E1E1E","#E5E5E5"] },
  { name: "Twitch",   category: "Tech Brands", stroke: "#9146FF", fill: "#A970FF", bg: "#ffffff", accents: ["#9146FF","#772CE8","#BF94FF","#A970FF","#E2D9F3","#5C16C5","#392E5C","#18181B","#0E0E10","#EFEFF1"] },
  { name: "Netflix",  category: "Tech Brands", stroke: "#E50914", fill: "#B1060F", bg: "#ffffff", accents: ["#E50914","#B1060F","#831010","#564D4D","#221F1F","#E50914","#737373","#000000","#B9090B","#F5F5F1"] },
  { name: "Firefox",  category: "Tech Brands", stroke: "#FF9400", fill: "#9059FF", bg: "#ffffff", accents: ["#FF9400","#FF2A6D","#9059FF","#00B3F4","#0090ED","#FF6C00","#B833E1","#20123A","#311A75","#FFD567"] },
  { name: "Notion",   category: "Tech Brands", stroke: "#191919", fill: "#EB5757", bg: "#ffffff", accents: ["#191919","#EB5757","#F2C94C","#6FCF97","#2F80ED","#9B51E0","#2F3437","#828282","#E0E0E0","#56CCF2"] },

  // --- Design Systems ---
  { name: "Material",   category: "Design Systems", stroke: "#2196F3", fill: "#F44336", bg: "#ffffff", accents: ["#2196F3","#F44336","#4CAF50","#FF9800","#9C27B0","#00BCD4","#FFEB3B","#795548","#607D8B","#E91E63"] },
  { name: "Tailwind",   category: "Design Systems", stroke: "#3B82F6", fill: "#22C55E", bg: "#ffffff", accents: ["#3B82F6","#EF4444","#22C55E","#F59E0B","#8B5CF6","#06B6D4","#EC4899","#14B8A6","#F97316","#6366F1"] },
  { name: "Bootstrap",  category: "Design Systems", stroke: "#0D6EFD", fill: "#6F42C1", bg: "#ffffff", accents: ["#0D6EFD","#6610F2","#6F42C1","#D63384","#DC3545","#FD7E14","#FFC107","#198754","#20C997","#0DCAF0"] },
  { name: "Fluent",     category: "Design Systems", stroke: "#0078D4", fill: "#107C10", bg: "#ffffff", accents: ["#0078D4","#107C10","#D13438","#FFB900","#5C2D91","#008575","#E3008C","#004E8C","#5C5C5C","#323130"] },
  { name: "Carbon",     category: "Design Systems", stroke: "#0F62FE", fill: "#6929C4", bg: "#ffffff", accents: ["#0F62FE","#6929C4","#1192E8","#005D5D","#9F1853","#FA4D56","#570408","#198038","#002D9C","#EE538B"] },
  { name: "Ant Design", category: "Design Systems", stroke: "#1677FF", fill: "#52C41A", bg: "#ffffff", accents: ["#1677FF","#F5222D","#52C41A","#FAAD14","#722ED1","#13C2C2","#EB2F96","#FA8C16","#2F54EB","#A0D911"] },

  // --- Nature ---
  { name: "Ocean",      category: "Nature", stroke: "#1E5F8C", fill: "#5DADE2", bg: "#ffffff", accents: ["#1E5F8C","#2E86C1","#5DADE2","#85C1E9","#0E4D6E","#21618C","#2874A6","#48A9C5","#0B3954","#AED6F1"] },
  { name: "Forest",     category: "Nature", stroke: "#1E5631", fill: "#52B788", bg: "#ffffff", accents: ["#1E5631","#2D6A4F","#40916C","#52B788","#74C69D","#95D5B2","#B7E4C7","#143620","#2F8F5B","#081C15"] },
  { name: "Sunset",     category: "Nature", stroke: "#D9480F", fill: "#FFA552", bg: "#ffffff", accents: ["#D9480F","#E8590C","#F76707","#FF922B","#FFA552","#FFC078","#C92A2A","#A61E22","#FFD8A8","#5C2018"] },
  { name: "Autumn",     category: "Nature", stroke: "#7C2D12", fill: "#C2410C", bg: "#ffffff", accents: ["#7C2D12","#9A3412","#C2410C","#EA580C","#F97316","#FB923C","#B45309","#92400E","#D97706","#451A03"] },
  { name: "Desert",     category: "Nature", stroke: "#A0522D", fill: "#DEB887", bg: "#ffffff", accents: ["#A0522D","#C19A6B","#DEB887","#E6CCAB","#8B5A2B","#B8860B","#CD853F","#D2B48C","#6B4226","#F5DEB3"] },
  { name: "Arctic",     category: "Nature", stroke: "#3A6EA5", fill: "#A9D6E5", bg: "#ffffff", accents: ["#3A6EA5","#61A5C2","#89C2D9","#A9D6E5","#CAF0F8","#2C7DA0","#468FAF","#013A63","#01497C","#E0FBFC"] },
  { name: "Coral Reef", category: "Nature", stroke: "#FF6B6B", fill: "#4ECDC4", bg: "#ffffff", accents: ["#FF6B6B","#FF8E72","#FFD166","#4ECDC4","#1A9E8F","#F08A5D","#B83B5E","#6A2C70","#FFB6A3","#08807A"] },
  { name: "Lavender",   category: "Nature", stroke: "#7B5EA7", fill: "#B39DDB", bg: "#ffffff", accents: ["#7B5EA7","#9575CD","#B39DDB","#D1C4E9","#5E35B1","#673AB7","#8E7CC3","#4527A0","#C5B3E6","#311B92"] },

  // --- Solids (single-hue families) ---
  { name: "Teal",    category: "Solids", stroke: "#0E7C7B", fill: "#6CCED2", bg: "#ffffff", accents: ["#0E7C7B","#0F9B9A","#17B8B7","#3FD0CE","#6CCED2","#0A5C5B","#08403F","#A0E8E6","#127C77","#053534"] },
  { name: "Amber",   category: "Solids", stroke: "#B8860B", fill: "#FFD582", bg: "#ffffff", accents: ["#B8860B","#D99E0B","#F1B13F","#FFC757","#FFD582","#946A00","#6B4D00","#FFE7B3","#E0A106","#4A3500"] },
  { name: "Crimson", category: "Solids", stroke: "#A61E1E", fill: "#FF8882", bg: "#ffffff", accents: ["#A61E1E","#C62828","#E53935","#FF5F57","#FF8882","#7A1414","#520C0C","#FFB3AF","#D32F2F","#330808"] },
  { name: "Violet",  category: "Solids", stroke: "#5E35B1", fill: "#D0BFFF", bg: "#ffffff", accents: ["#5E35B1","#6741D9","#7C4DFF","#9D7BFF","#D0BFFF","#4527A0","#311B92","#E5DBFF","#6A3FD9","#1F0A5C"] },
  { name: "Rose",    category: "Solids", stroke: "#A61E4D", fill: "#FCC2D7", bg: "#ffffff", accents: ["#A61E4D","#C2255C","#E64980","#F783AC","#FCC2D7","#7A1538","#520C25","#FFE0EC","#D6336C","#330616"] },
  { name: "Indigo",  category: "Solids", stroke: "#283593", fill: "#BAC8FF", bg: "#ffffff", accents: ["#283593","#364FC7","#4263EB","#5C7CFA","#BAC8FF","#1D2769","#101640","#DBE4FF","#3B5BDB","#080B24"] },
  { name: "Emerald", category: "Solids", stroke: "#0B6E4F", fill: "#6EE7B7", bg: "#ffffff", accents: ["#0B6E4F","#0F9268","#10B981","#34D399","#6EE7B7","#085C42","#04412E","#A7F3D0","#0EA572","#022C1E"] },
  { name: "Slate",   category: "Solids", stroke: "#334155", fill: "#94A3B8", bg: "#ffffff", accents: ["#334155","#475569","#64748B","#94A3B8","#CBD5E1","#1E293B","#0F172A","#E2E8F0","#52617A","#020617"] },

  // --- Vibrant ---
  { name: "Cyberpunk", category: "Vibrant", stroke: "#FF007A", fill: "#00F0FF", bg: "#ffffff", accents: ["#FF007A","#FE00FE","#00F0FF","#00FFD5","#FAFF00","#FF9E00","#B026FF","#7700FF","#0F3460","#1A1A2E"] },
  { name: "Neon",      category: "Vibrant", stroke: "#39FF14", fill: "#FF00FF", bg: "#ffffff", accents: ["#39FF14","#FF00FF","#00FFFF","#FFFF00","#FF6EC7","#FE019A","#04D9FF","#CCFF00","#FF3131","#7DF9FF"] },
  { name: "Synthwave", category: "Vibrant", stroke: "#F72585", fill: "#7209B7", bg: "#ffffff", accents: ["#F72585","#B5179E","#7209B7","#560BAD","#480CA8","#3A0CA3","#3F37C9","#4361EE","#4895EF","#4CC9F0"] },
  { name: "Pastel",    category: "Vibrant", stroke: "#A8DADC", fill: "#FFC8DD", bg: "#ffffff", accents: ["#A8DADC","#FFAFCC","#FFC8DD","#BDE0FE","#CDB4DB","#B9FBC0","#FDE4CF","#FBF8CC","#C1D3FE","#98C1D9"] },
  { name: "Candy",     category: "Vibrant", stroke: "#FF4D6D", fill: "#FF99AC", bg: "#ffffff", accents: ["#FF4D6D","#FF8FA3","#FFB3C1","#FF99AC","#C9184A","#FF7096","#FFCCD5","#A4133C","#FF5C8A","#590D22"] },
  { name: "Tropical",  category: "Vibrant", stroke: "#06D6A0", fill: "#FFD166", bg: "#ffffff", accents: ["#06D6A0","#FFD166","#EF476F","#118AB2","#073B4C","#08C18C","#FFC43D","#E63E62","#0E7FA0","#FFE08A"] },

  // --- Minimal ---
  { name: "Mono",       category: "Minimal", stroke: "#1A1A1A", fill: "#9E9E9E", bg: "#ffffff", accents: ["#1A1A1A","#424242","#616161","#9E9E9E","#BDBDBD","#E0E0E0","#757575","#212121","#505050","#F5F5F5"] },
  { name: "Mono Ink",   category: "Minimal", stroke: "#1B1B1E", fill: "#5C5C66", bg: "#ffffff", accents: ["#1B1B1E","#3A3A40","#5C5C66","#8A8A94","#B8B8C0","#DCDCE0","#F2F2F5","#2B4C7E","#4A6FA5","#0A0A0C"] },
  { name: "Blueprint",  category: "Minimal", stroke: "#0D3B66", fill: "#2E8BC0", bg: "#ffffff", accents: ["#0D3B66","#1D5B8F","#2E8BC0","#5BC0EB","#B8E1FF","#9FB3C8","#627D98","#334E68","#102A43","#0A2A4A"] },
  { name: "Sepia",      category: "Minimal", stroke: "#5B4636", fill: "#C9B79C", bg: "#ffffff", accents: ["#5B4636","#7A5C44","#9C7A5B","#C9B79C","#E4D5BE","#3D2F22","#A68A64","#8B6F47","#6F5742","#2A1F16"] },
  { name: "Grayscale",  category: "Minimal", stroke: "#000000", fill: "#808080", bg: "#ffffff", accents: ["#000000","#262626","#404040","#595959","#737373","#8C8C8C","#A6A6A6","#BFBFBF","#D9D9D9","#1A1A1A"] },
];

let settings = ea.getScriptSettings();

function loadSchemes() {
  const raw = settings[SETTINGS_KEY] && settings[SETTINGS_KEY].value;
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SCHEMES));
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (e) {
    console.error("Color Scheme Manager: could not parse saved schemes", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SCHEMES));
}

let schemes = loadSchemes();

function saveSchemes() {
  settings = ea.getScriptSettings();
  settings[SETTINGS_KEY] = {
    value: JSON.stringify(schemes),
    description: "Color schemes saved by the Color Scheme Manager script. Edit via the side panel rather than here.",
  };
  ea.setScriptSettings(settings);
}

// Seed defaults into settings on first run so they survive.
if (!settings[SETTINGS_KEY]) saveSchemes();

// One-time merge of newly-shipped preset schemes into the user's saved set.
// Gated by a version flag so it runs once per preset-set bump and respects
// any presets the user later deletes (their deletions stick).
const PRESET_VERSION = 5;
function ensurePresets() {
  settings = ea.getScriptSettings();
  const stored = settings["Preset version"] ? Number(settings["Preset version"].value) : 0;
  if (stored >= PRESET_VERSION) return 0;
  const have = new Set(schemes.map((s) => s.name.toLowerCase()));
  let added = 0;
  for (const p of DEFAULT_SCHEMES) {
    if (!have.has(p.name.toLowerCase())) {
      schemes.push({ ...p });
      added++;
    }
  }
  settings[SETTINGS_KEY] = {
    value: JSON.stringify(schemes),
    description: "Color schemes saved by the Color Scheme Manager script. Edit via the side panel rather than here.",
  };
  settings["Preset version"] = {
    value: PRESET_VERSION,
    description: "Internal: which built-in preset set has been merged. Do not edit.",
  };
  ea.setScriptSettings(settings);
  return added;
}
ensurePresets();

// Normalise saved schemes: canvas background is always pure white, and every
// scheme gets a full 10-accent set so its extended palette offers 15 swatches
// (older simple presets only had a stroke/fill pair).
{
  const catByName = new Map(DEFAULT_SCHEMES.map((s) => [s.name.toLowerCase(), s.category]));
  let changed = false;
  for (const s of schemes) {
    if (s.bg !== "#ffffff") {
      s.bg = "#ffffff";
      changed = true;
    }
    if (!Array.isArray(s.accents) || s.accents.length < 10) {
      s.accents = synthAccents(s.stroke, s.fill);
      changed = true;
    }
    if (!s.category) {
      s.category = catByName.get(s.name.toLowerCase()) || "Custom";
      changed = true;
    } else {
      // Heal malformed categories from older imports (e.g. one that swallowed
      // following comment lines): keep only the first line, cut at any '#'.
      const clean = String(s.category).split(/[#\n\r]/)[0].trim();
      if (clean !== s.category) {
        s.category = clean || "Custom";
        changed = true;
      }
    }
  }
  if (changed) saveSchemes();
}

// Track which scheme was last applied, so the panel can show what's active.
// Persisted so it survives panel reopen / app reload. "" means Default/none.
let activeScheme = settings["Active scheme"] ? settings["Active scheme"].value : "";
// Currently selected category filter for the panel ("All" = show everything).
let selectedCategory = settings["Active category"] ? settings["Active category"].value : "All";
function setCategory(cat) {
  selectedCategory = cat || "All";
  settings = ea.getScriptSettings();
  settings["Active category"] = { value: selectedCategory, description: "Internal: panel category filter." };
  ea.setScriptSettings(settings);
}
// When on (and the MindMap Builder API is present), applying a scheme recolours
// the active mind map per-branch. SESSION-ONLY and always starts OFF on each
// script load (not persisted) — a deliberate, opt-in action each session.
let mmbSync = false;
function setMmbSync(on) {
  mmbSync = !!on;
}
// Ordered list of categories present in the current schemes, plus "All".
function categoryList() {
  const present = new Set(schemes.map((s) => s.category || "Custom"));
  const ordered = CATEGORY_ORDER.filter((c) => present.has(c));
  for (const c of present) if (!ordered.includes(c)) ordered.push(c);
  return ["All", ...ordered];
}
// Ask the user to choose a category for a scheme (existing one or a new name).
// Returns the chosen category, or `current` if cancelled.
async function pickCategory(current) {
  const present = Array.from(new Set(schemes.map((s) => s.category || "Custom")));
  for (const c of CATEGORY_ORDER) if (!present.includes(c)) present.push(c);
  const NEW = "＋ New category…";
  const choice = await utils.suggester([...present, NEW], [...present, NEW], "Choose a category (ESC to keep current)");
  if (choice === undefined) return current || "Custom";
  if (choice === NEW) {
    const name = await utils.inputPrompt("New category", "Category name", current || "Custom");
    return name && name.trim() ? name.trim() : current || "Custom";
  }
  return choice;
}
function setActive(name) {
  activeScheme = name || "";
  settings = ea.getScriptSettings();
  settings["Active scheme"] = {
    value: activeScheme,
    description: "Internal: the scheme last applied from the panel. Do not edit.",
  };
  ea.setScriptSettings(settings);
}

// ------------------------------------------------------------------
// Color picking helper (uses Excalidraw's native palette)
// palette: "elementStroke" | "elementBackground" | "canvasBackground"
// ------------------------------------------------------------------
async function pickColor(anchorEl, palette, fallback) {
  try {
    const selected = await ea.showColorPicker(anchorEl, palette);
    return selected || fallback;
  } catch (e) {
    console.error("Color Scheme Manager: color picker failed", e);
    return fallback;
  }
}

// ------------------------------------------------------------------
// Build the native color-picker palette from ALL saved schemes, so the
// picker grid shows every scheme's colors as options at once.
//
// The picker reads appState.colorPalette[category] as an array whose
// entries are EITHER a single color string (one grid swatch, no shades)
// OR a row of strings (one grid swatch + its shade variants). For each
// base color we generate a 5-shade row per category — exactly like the
// official Palette Loader — so the "Shades" section is populated too.
// The palette must be written via ea.viewUpdateScene (NOT api.updateScene)
// for the live picker to pick it up.
// ------------------------------------------------------------------

// Loader-faithful shade generator: 5 lightness variants of a base color,
// ordered so the representative swatch suits stroke / fill / canvas use.
function getShades(c, type) {
  if (!c || c === "transparent") return c || "transparent";
  let cm;
  try { cm = ea.getCM(c); } catch (e) { return c; }
  if (!cm) return c;
  const L = cm.lightness;
  if (L === 0 || L === 100) return c; // pure black / white have no useful shades
  const hex = (x) => ea.getCM(c).lightnessTo(x).stringHEX({ alpha: false });
  const up1 = (100 - L) * 0.5 + L;
  const up2 = (100 - L) * 0.25 + L;
  const dn1 = L * 0.5;
  const dn2 = L * 0.25;
  switch (type) {
    case "canvas":     return [c, hex(up1), hex(up2), hex(dn1), hex(dn2)];
    case "stroke":     return [hex(up1), hex(up2), hex(dn1), hex(dn2), c];
    case "background": return [hex(up1), c, hex(up2), hex(dn1), hex(dn2)];
    default:           return [c, hex(up1), hex(up2), hex(dn1), hex(dn2)];
  }
}

function dedupe(colors) {
  const seen = new Set();
  const out = [];
  for (const c of colors) {
    if (!c) continue;
    const key = String(c).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

// Analogous spread of one color: same color at hue -30/-15/0/+15/+30. For a
// near-grey colour (low saturation) the variants collapse and we just keep it.
function analogous(color) {
  if (!color || color === "transparent") return [color || "transparent"];
  let cm;
  try { cm = ea.getCM(color); } catch (e) { return [color]; }
  if (!cm) return [color];
  const out = [];
  for (const d of [-30, -15, 0, 15, 30]) {
    try { out.push(ea.getCM(color).hueBy(d).stringHEX({ alpha: false })); }
    catch (e) { out.push(color); }
  }
  return dedupe(out);
}

// The 5 quick-pick swatches shown in the toolbar's Stroke / Background rows.
function pick5(colors, lead) {
  const out = [];
  const add = (c) => {
    if (!c || out.length >= 5) return;
    if (!out.some((x) => String(x).toLowerCase() === String(c).toLowerCase())) out.push(c);
  };
  add(lead);
  colors.forEach(add);
  while (out.length < 5) out.push(out[out.length - 1] || "#1e1e1e");
  return out.slice(0, 5);
}

// Assemble a colorPalette object from per-category base-color lists. Each base
// becomes a grid swatch with its shade row; the leads seed the top-pick rows.
function paletteFromBases(strokeBases, fillBases, canvasBases) {
  return {
    canvasBackground:  canvasBases.map((c) => getShades(c, "canvas")),
    elementStroke:     strokeBases.map((c) => getShades(c, "stroke")),
    elementBackground: fillBases.map((c) => getShades(c, "background")),
    topPicks: {
      elementStroke:     pick5(strokeBases, "#1e1e1e"),
      elementBackground: pick5(fillBases, "transparent"),
      canvasBackground:  pick5(canvasBases, "#ffffff"),
    },
  };
}

// Picker palette for ONE scheme: an analogous family of its stroke (lines),
// its fill, and its canvas background — unique to that scheme.
function paletteForScheme(scheme) {
  return paletteFromBases(
    dedupe(["#1e1e1e", ...analogous(scheme.stroke)]),
    dedupe(["transparent", ...analogous(scheme.fill)]),
    ["#ffffff"] // canvas background is always pure white, never themed
  );
}

// Picker palette spanning EVERY saved scheme (the overview).
function paletteForAll() {
  return paletteFromBases(
    dedupe(["#1e1e1e", ...schemes.map((s) => s.stroke)]),
    dedupe(["transparent", ...schemes.map((s) => s.fill)]),
    ["#ffffff"] // canvas background is always pure white, never themed
  );
}

// Synthesize 10 harmonious accents from a couple of picked colours, so a
// user-created or imported scheme gets the same rich 15-swatch extended palette
// as the built-in themes. Seeds a spread of hue rotations around the stroke and
// folds in the fill colour.
function synthAccents(stroke, fill) {
  const out = [];
  const seen = new Set();
  const add = (c) => {
    if (!c) return;
    const k = String(c).toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(c);
  };
  let baseL = 50;
  try { baseL = ea.getCM(stroke).lightness; } catch (e) { /* keep default */ }
  // Analogous hues around the stroke (keeps the family coherent / on-brand).
  for (const d of [0, 18, -18, 36, -36]) {
    try { add(ea.getCM(stroke).hueBy(d).stringHEX({ alpha: false })); } catch (e) { /* skip */ }
  }
  // Lighter + darker tonal variants of the stroke for range.
  for (const t of [Math.min(88, baseL + 22), Math.max(14, baseL - 22), Math.min(94, baseL + 42)]) {
    try { add(ea.getCM(stroke).lightnessTo(t).stringHEX({ alpha: false })); } catch (e) { /* skip */ }
  }
  // The fill colour, plus one wider accent for contrast.
  try { if (fill && fill !== "transparent") add(ea.getCM(fill).stringHEX({ alpha: false })); } catch (e) { /* skip */ }
  try { add(ea.getCM(stroke).hueBy(150).stringHEX({ alpha: false })); } catch (e) { /* skip */ }
  // Pad (e.g. for low-saturation greys where hue shifts collapse).
  while (out.length < 10) out.push(out[out.length - 1] || stroke);
  return out.slice(0, 10);
}

// --- Rich theme palette (for schemes that carry a 10-colour `accents` list) ---
const darken = (c) => {
  const l = ea.getCM(c).lightness;
  return ea.getCM(c).lightnessTo(l * 0.8).stringHEX({ alpha: false });
};
const lightTint = (c) => {
  const l = ea.getCM(c).lightness;
  return ea.getCM(c).lightnessTo((100 - l) * 0.55 + l).stringHEX({ alpha: false });
};

// Build a full 15-swatch stroke + fill palette from 10 theme accents.
// Only three cells are fixed anchors (transparent, black, white) — every other
// swatch is theme-derived, so the bulk of the grid changes per theme. Canvas
// background stays pure white.
// The 15 base swatches a theme produces (transparent + 10 accents + a light
// tint & dark shade of the primary + black + white). Used by both the palette
// builder and the picker editor (to pre-fill).
function themeFlat(accents) {
  return [
    "transparent",          // the only always-available "no colour"
    accents[0],
    accents[1],
    accents[2],
    accents[3],
    accents[4],
    accents[5],
    accents[6],
    accents[7],
    accents[8],
    accents[9],
    lightTint(accents[0]),  // light tint of the primary
    darken(accents[0]),     // dark shade of the primary
    "black",                // fixed anchor
    "white",                // fixed anchor
  ];
}

function buildThemePalette(accents) {
  const flat = themeFlat(accents);
  const WHITE = "#ffffff";
  return {
    elementStroke:     flat.map((c) => getShades(c, "stroke")),
    elementBackground: flat.map((c) => getShades(c, "background")),
    canvasBackground:  [WHITE],
    topPicks: {
      elementStroke: ["black", darken(accents[0]), darken(accents[5]), darken(accents[1]), darken(accents[6])],
      elementBackground: ["transparent", lightTint(accents[0]), lightTint(accents[5]), lightTint(accents[1]), lightTint(accents[6])],
      canvasBackground: [WHITE, WHITE, WHITE, WHITE, WHITE],
    },
  };
}

// Build a palette from an EXPLICIT picker spec: separate stroke + fill grids
// (each up to 15 swatches) and optional 5-colour top-pick rows. Canvas = white.
function buildExplicitPalette(picker) {
  const WHITE = "#ffffff";
  const stroke = (picker.stroke && picker.stroke.length ? picker.stroke : ["#1e1e1e"]).slice(0, 15);
  const fill = (picker.fill && picker.fill.length ? picker.fill : ["transparent"]).slice(0, 15);
  return {
    elementStroke: stroke.map((c) => getShades(c, "stroke")),
    elementBackground: fill.map((c) => getShades(c, "background")),
    canvasBackground: [WHITE],
    topPicks: {
      elementStroke: pick5(picker.topStroke && picker.topStroke.length ? picker.topStroke : stroke, "black"),
      elementBackground: pick5(picker.topFill && picker.topFill.length ? picker.topFill : fill, "transparent"),
      canvasBackground: [WHITE, WHITE, WHITE, WHITE, WHITE],
    },
  };
}

// One entry point: explicit picker spec > raw appState palette > theme accents
// > simple analogous.
function buildSchemePalette(scheme) {
  if (scheme.picker && (scheme.picker.stroke || scheme.picker.fill)) return buildExplicitPalette(scheme.picker);
  if (scheme.rawPalette) return scheme.rawPalette; // loaded verbatim
  if (scheme.accents) return buildThemePalette(scheme.accents);
  return paletteForScheme(scheme);
}

// Representative base colour of one colorPalette entry (string, or a [shades]
// array — pick its first usable colour).
function entryBase(entry) {
  if (Array.isArray(entry)) {
    for (const c of entry) {
      const k = String(c || "").toLowerCase();
      if (c && k !== "transparent" && k !== "black" && k !== "white") return c;
    }
    return entry[0];
  }
  return entry;
}

// The base swatch lists currently driving a scheme's picker — used to pre-fill
// the Customize editor (from an explicit spec, a raw palette, a theme, or a
// simple scheme).
function effectiveBases(scheme) {
  if (scheme.picker && (scheme.picker.stroke || scheme.picker.fill)) {
    return {
      stroke: (scheme.picker.stroke || []).slice(),
      fill: (scheme.picker.fill || []).slice(),
      topStroke: (scheme.picker.topStroke || []).slice(),
      topFill: (scheme.picker.topFill || []).slice(),
    };
  }
  if (scheme.rawPalette) {
    const p = scheme.rawPalette;
    return {
      stroke: (p.elementStroke || []).map(entryBase),
      fill: (p.elementBackground || []).map(entryBase),
      topStroke: (p.topPicks && p.topPicks.elementStroke) || [],
      topFill: (p.topPicks && p.topPicks.elementBackground) || [],
    };
  }
  if (scheme.accents) {
    const flat = themeFlat(scheme.accents);
    return { stroke: flat.slice(), fill: flat.slice(), topStroke: [], topFill: [] };
  }
  return {
    stroke: dedupe(["#1e1e1e", ...analogous(scheme.stroke)]),
    fill: dedupe(["transparent", ...analogous(scheme.fill)]),
    topStroke: [],
    topFill: [],
  };
}

// The built-in catalog entry for a scheme name (or null for user schemes).
function catalogDefault(name) {
  const key = String(name).toLowerCase();
  return DEFAULT_SCHEMES.find((s) => s.name.toLowerCase() === key) || null;
}

// First non-anchor colour in a list (transparent/black/white are anchors), used
// for a scheme's row-preview stroke/fill so it never shows as transparent.
function firstRealColor(list) {
  return list.find((c) => c && c !== "transparent" && c !== "black" && c !== "white") || list[0];
}

// The auto-generated base lists for a scheme, IGNORING any custom picker — used
// by the editor's "Defaults…" action to revert to a theme's original colours.
function autoBases(scheme) {
  if (scheme.accents) {
    const flat = themeFlat(scheme.accents);
    return { stroke: flat.slice(), fill: flat.slice() };
  }
  return {
    stroke: dedupe(["#1e1e1e", ...analogous(scheme.stroke)]),
    fill: dedupe(["transparent", ...analogous(scheme.fill)]),
  };
}

// ------------------------------------------------------------------
// MindMap Builder integration (optional — only when that script is installed
// and its API is ready). https://github.com/zsviczian/obsidian-excalidraw-plugin
// docs/ea-script-docs/MindMapBuilderAPI.md
// ------------------------------------------------------------------
function mmbReady() {
  try {
    const mmb = window.MindMapBuilderAPI;
    return !!(mmb && typeof mmb.ready === "function" && mmb.ready());
  } catch (e) {
    return false;
  }
}

// All element ids that belong to a MindMap Builder map on this canvas. Used to
// LEAVE the mind map untouched when MindMap mode is OFF (the plugin keeps the
// root node selected, which would otherwise get caught by the selection recolour).
function mindmapElementIds() {
  const ids = new Set();
  if (!mmbReady()) return ids;
  try {
    const mmb = window.MindMapBuilderAPI;
    const rootsRes = typeof mmb.getMindMapRoots === "function" ? mmb.getMindMapRoots() : null;
    const rootIds = rootsRes && rootsRes.ok ? rootsRes.data.rootIds || [] : [];
    for (const root of rootIds) {
      ids.add(root);
      if (typeof mmb.getProjectElementIds === "function") {
        const r = mmb.getProjectElementIds(root);
        if (r && r.ok) for (const id of r.data.ids || []) ids.add(id);
      }
    }
  } catch (e) {
    console.error("Color Scheme Manager: mindmapElementIds failed", e);
  }
  return ids;
}

// The list of real colours a scheme contributes to a mind map's branch palette
// (anchors transparent/black/white dropped), REORDERED so consecutive branches
// look as different as possible. Many themes list their accents hue-adjacent
// (e.g. several blues in a row), which made neighbouring branches near-identical;
// we sort by hue then interleave the two halves so each step jumps ~half the
// colour wheel.
function schemeMindmapColors(scheme) {
  let src;
  if (scheme.picker && scheme.picker.stroke && scheme.picker.stroke.length) src = scheme.picker.stroke;
  else if (scheme.rawPalette && Array.isArray(scheme.rawPalette.elementStroke)) src = scheme.rawPalette.elementStroke.map(entryBase);
  else if (scheme.accents && scheme.accents.length) src = scheme.accents;
  else src = autoBases(scheme).stroke;

  // dedupe + drop anchors
  const list = [];
  const seen = new Set();
  for (const c of src) {
    if (!c) continue;
    const k = String(c).toLowerCase();
    if (k === "transparent" || k === "black" || k === "white" || seen.has(k)) continue;
    seen.add(k);
    list.push(c);
  }
  if (list.length <= 2) return list.length ? list : [scheme.stroke || "#1e1e1e"];

  // sort by hue, then interleave halves for maximum adjacent contrast
  const withHue = list.map((c) => {
    let h = 0;
    try {
      const v = ea.getCM(c).hue;
      if (typeof v === "number" && !Number.isNaN(v)) h = v;
    } catch (e) {
      /* keep 0 */
    }
    return { c, h };
  });
  withHue.sort((a, b) => a.h - b.h);
  const n = withHue.length;
  const half = Math.ceil(n / 2);
  const out = [];
  for (let k = 0; k < half; k++) {
    out.push(withHue[k].c);
    if (k + half < n) out.push(withHue[k + half].c);
  }
  return out;
}

// Generate `n` MAXIMALLY DISTINCT branch colours for a scheme. Colours are
// spaced evenly around the hue wheel (so no two branches look alike), using the
// theme's most-saturated accent for the saturation/lightness "feel" and as the
// starting hue. For (near-)greyscale themes there is no hue to spread, so we
// fall back to evenly spaced light→dark steps instead.
function distinctBranchColors(scheme, n) {
  if (n <= 0) return [];
  const accents = schemeMindmapColors(scheme);
  // pick the most saturated accent as the generator base
  let base = accents[0] || scheme.stroke || "#1e1e1e";
  let bestSat = -1;
  for (const c of accents) {
    try {
      const s = ea.getCM(c).saturation;
      if (typeof s === "number" && s > bestSat) { bestSat = s; base = c; }
    } catch (e) { /* skip */ }
  }

  const out = [];
  let baseHue = 0;
  let baseCM = null;
  try { baseCM = ea.getCM(base); baseHue = baseCM.hue || 0; } catch (e) { /* */ }

  // (near-)greyscale -> spread by lightness instead of hue
  if (bestSat < 12 || !baseCM) {
    for (let i = 0; i < n; i++) {
      const L = n === 1 ? 50 : 14 + (i * (88 - 14)) / (n - 1);
      try { out.push(ea.getCM(base).lightnessTo(L).stringHEX({ alpha: false })); }
      catch (e) { out.push(base); }
    }
    return out;
  }

  for (let i = 0; i < n; i++) {
    const targetHue = (baseHue + (i * 360) / n) % 360;
    try {
      const cm = ea.getCM(base);
      out.push(cm.hueBy(targetHue - cm.hue).stringHEX({ alpha: false }));
    } catch (e) {
      out.push(base);
    }
  }
  return out;
}

// Push a scheme's colours into the MindMap Builder's custom branch palette.
async function applyToMindMap(scheme) {
  // Silent on apply — the only user-facing message is the toggle on/off notice.
  const mmb = window.MindMapBuilderAPI;
  if (!mmbReady() || !ea.targetView) {
    return false;
  }
  const colors = schemeMindmapColors(scheme);

  // Best-effort: also set the global palette so newly-added branches stay on
  // theme (non-fatal if it fails).
  try {
    await mmb.setGlobalConfig({
      patch: { multicolor: true, customPalette: { enabled: true, random: false, colors } },
    });
  } catch (e) {
    /* non-fatal */
  }

  const rootsRes = typeof mmb.getMindMapRoots === "function" ? mmb.getMindMapRoots() : null;
  const rootIds = rootsRes && rootsRes.ok ? rootsRes.data.rootIds || [] : [];
  if (!rootIds.length) {
    return false; // no map on this canvas — nothing to do, stay silent
  }

  // Map each element id to a colour:
  //   - the centre/root node  -> the scheme's primary stroke
  //   - each first-level branch (its whole subtree) -> the next palette colour
  //   - each connector line    -> the colour of the branch it points into
  // Structure comes from the MindMap Builder API; the recolour is done directly
  // with ExcalidrawAutomate (reliable, no rebuild).
  const rootColor = scheme.stroke || colors[0];
  const idColor = new Map();
  let branchCount = 0;
  const byId = new Map(ea.getViewElements().map((el) => [el.id, el]));
  try {
    for (const root of rootIds) {
      // The root id from getMindMapRoots IS the centre node element.
      idColor.set(root, rootColor);

      const roles = mmb.getElementIdsByRole(root);
      const nodeIds = roles && roles.ok ? roles.data.nodes || [] : [];
      const branchArrows = roles && roles.ok ? roles.data.branchArrows || [] : [];

      // First-level branches (depth 1). Gather them first, then expand the
      // palette to the branch count so EACH branch gets a UNIQUE colour (no
      // cycling/reuse when a map has more branches than the theme has colours).
      const firstLevel = [];
      for (const nid of nodeIds) {
        const info = mmb.getMapInfo(nid);
        if (info && info.ok && info.data.depth === 1) firstLevel.push(nid);
      }
      const palette = distinctBranchColors(scheme, firstLevel.length);
      firstLevel.forEach((nid, idx) => {
        const color = palette[idx % palette.length];
        branchCount++;
        const br = mmb.getBranchElementIds({ nodeId: nid, includeDecorations: true, includeCrosslinks: false });
        const ids = br && br.ok ? br.data.ids || [] : [];
        for (const id of ids) idColor.set(id, color);
      });

      // Connector lines: colour each arrow by the branch it connects to. Use the
      // arrow's bindings; prefer the non-root (child) endpoint so the line INTO a
      // branch takes the branch colour rather than the centre's colour.
      for (const arrowId of branchArrows) {
        if (idColor.has(arrowId)) continue;
        const el = byId.get(arrowId);
        if (!el) continue;
        const ends = [
          el.endBinding && el.endBinding.elementId,
          el.startBinding && el.startBinding.elementId,
        ];
        let chosen = null;
        for (const ep of ends) {
          if (ep && idColor.has(ep) && idColor.get(ep) !== rootColor) { chosen = idColor.get(ep); break; }
        }
        if (!chosen) for (const ep of ends) if (ep && idColor.has(ep)) { chosen = idColor.get(ep); break; }
        if (chosen) idColor.set(arrowId, chosen);
      }
    }
  } catch (e) {
    console.error("Color Scheme Manager: reading mind map structure failed", e);
  }

  if (!idColor.size) {
    console.warn("Color Scheme Manager: couldn't read the mind map structure to recolour it.");
    return false;
  }

  try {
    ea.clear();
    const targets = ea.getViewElements().filter((el) => idColor.has(el.id));
    if (!targets.length) {
      console.warn("Color Scheme Manager: mind map elements not found on the canvas to recolour.");
      return false;
    }
    ea.copyViewElementsToEAforEditing(targets);
    for (const el of ea.getElements()) {
      const c = idColor.get(el.id);
      if (c) el.strokeColor = c;
    }
    await ea.addElementsToView(false, false);
    return true;
  } catch (e) {
    console.error("Color Scheme Manager: mind map recolour apply failed", e);
    return false;
  }
}

// Parse the structured import format (NAME/CATEGORY/STROKE/FILL/TOPPICKS_* keys).
// Returns null if no section keys are present (so the caller falls back to the
// simple flat hex-list import).
function parseStructuredImport(raw) {
  // NAME/CATEGORY are single-line (value is only what's on their own line);
  // STROKE/FILL/TOPPICKS_* are multi-line (following colour rows belong to them).
  const SINGLE = ["NAME", "CATEGORY"];
  const MULTI = ["STROKE", "FILL", "TOPPICKS_STROKE", "TOPPICKS_FILL"];
  const KEYS = [...SINGLE, ...MULTI];
  const data = {};
  let cur = null; // only ever a MULTI key
  let sawSection = false;
  for (const line of raw.replace(/\r/g, "").split("\n")) {
    // Skip comment lines: a "#" that is NOT a #RRGGBB colour (so "# notes" and
    // "# --- STROKE ---" are ignored, but "#FF0000" is kept).
    if (/^\s*#(?![0-9a-fA-F]{6}\b)/.test(line)) continue;

    const m = line.match(/^\s*([A-Z_]+)\s*[:=]\s*(.*)$/);
    if (m && KEYS.includes(m[1])) {
      sawSection = true;
      const key = m[1];
      data[key] = (data[key] ? data[key] + " " : "") + m[2];
      cur = MULTI.includes(key) ? key : null; // single-line keys don't capture following lines
    } else if (cur) {
      data[cur] += " " + line;
    }
  }
  return sawSection ? data : null;
}

// Pull valid #RRGGBB strings (and the literal "transparent") out of a chunk.
function extractColors(text) {
  if (!text) return [];
  const out = [];
  for (const tok of text.split(/[\s,]+/)) {
    const t = tok.trim().toLowerCase();
    if (!t) continue;
    if (t === "transparent" || t === "black" || t === "white") { out.push(t); continue; }
    const m = t.match(/^#?[0-9a-f]{6}$/);
    if (!m) continue;
    const hex = t.startsWith("#") ? t : "#" + t;
    try {
      const cm = ea.getCM(hex);
      if (cm) out.push(cm.stringHEX({ alpha: false }));
    } catch (e) {
      /* skip */
    }
  }
  return out;
}

// Detect & parse a raw Excalidraw appState colorPalette object (the exact JSON
// you can copy from a drawing's appState). Accepts either the bare palette or
// an object with a `colorPalette` key. Returns the palette or null.
function parseRawPalette(raw) {
  const t = String(raw || "").trim();
  if (!t.startsWith("{")) return null;
  let obj;
  try {
    obj = JSON.parse(t);
  } catch (e) {
    return null;
  }
  const pal = obj && obj.colorPalette ? obj.colorPalette : obj;
  if (
    pal &&
    (Array.isArray(pal.elementStroke) || Array.isArray(pal.elementBackground) || Array.isArray(pal.canvasBackground))
  ) {
    return pal;
  }
  return null;
}

// First usable colour from a colorPalette category array (entries are either a
// colour string or a [shades] array). Skips transparent/black/white anchors.
function firstColorFrom(arr) {
  for (const entry of arr || []) {
    const cands = Array.isArray(entry) ? entry : [entry];
    for (const c of cands) {
      const k = String(c || "").toLowerCase();
      if (c && k !== "transparent" && k !== "black" && k !== "white") return c;
    }
  }
  return null;
}

// Build + save a scheme from raw import text. Supports: a raw appState
// colorPalette JSON (loaded verbatim), the labelled STROKE:/FILL: format, or a
// simple flat hex list. Shared by paste-import and file-import. Returns true on
// success.
async function importColors(raw) {
  if (!raw || !raw.trim()) return false;

  // 1) Raw appState colorPalette JSON — load the exact palette (shades + top
  // picks) without regenerating anything.
  const rawPal = parseRawPalette(raw);
  if (rawPal) {
    let name = await utils.inputPrompt("Import — name", "Scheme name", "Imported palette");
    if (!name || !name.trim()) return false;
    const category = await pickCategory("Custom");
    const scheme = {
      name: name.trim(),
      category,
      stroke: firstColorFrom(rawPal.elementStroke) || "#1e1e1e",
      fill: firstColorFrom(rawPal.elementBackground) || "transparent",
      bg: "#ffffff",
      rawPalette: rawPal,
    };
    schemes.push(scheme);
    setCategory(scheme.category);
    saveSchemes();
    if (renderPanel) renderPanel();
    return true;
  }

  const structured = parseStructuredImport(raw);
  let scheme;

  if (structured && (structured.STROKE || structured.FILL)) {
    // Full control: explicit STROKE / FILL grids (+ optional top-picks).
    const stroke = extractColors(structured.STROKE);
    let fill = extractColors(structured.FILL);
    if (!stroke.length && !fill.length) {
      new Notice("No valid colours found under STROKE: / FILL:.");
      return false;
    }
    if (!fill.length) fill = stroke.slice();
    if (!stroke.length) return false;
    let name = (structured.NAME || "").trim();
    if (!name) {
      name = await utils.inputPrompt("Import — name", "Scheme name", "My import");
      if (!name || !name.trim()) return false;
    }
    let category = (structured.CATEGORY || "").trim();
    if (!category) category = await pickCategory("Custom");
    scheme = {
      name: name.trim(),
      category,
      stroke: stroke[0] || "#1e1e1e",
      fill: fill[0] || "transparent",
      bg: "#ffffff",
      picker: {
        stroke,
        fill,
        topStroke: extractColors(structured.TOPPICKS_STROKE),
        topFill: extractColors(structured.TOPPICKS_FILL),
      },
    };
  } else {
    // Simple flat list -> auto-derived stroke/fill grids via accents.
    const flat = extractColors(raw);
    if (flat.length < 2) {
      new Notice("Need at least 2 valid colours (or use the STROKE:/FILL: format).");
      return false;
    }
    let accents;
    if (flat.length >= 6) {
      accents = flat.slice(0, 10);
      while (accents.length < 10) accents.push(flat[accents.length % flat.length]);
    } else {
      accents = synthAccents(flat[0], flat[1] || flat[0]);
    }
    const name = await utils.inputPrompt("Import — name", "Scheme name", "My import");
    if (!name || !name.trim()) return false;
    const category = await pickCategory("Custom");
    scheme = {
      name: name.trim(),
      category,
      stroke: flat[0],
      fill: flat[1] || accents[1],
      bg: "#ffffff",
      accents,
    };
  }

  schemes.push(scheme);
  setCategory(scheme.category);
  saveSchemes();
  if (renderPanel) renderPanel();
  return true;
}

// Open a native file chooser and return the selected text file's contents
// (or null if cancelled). Used by the "Import" file option.
function pickTextFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.csv,.json,text/plain,application/json";
    input.style.display = "none";
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", onFocus);
      try { input.remove(); } catch (e) {}
      resolve(val);
    };
    const onFocus = () => {
      // Fires when the OS dialog closes; if nothing was chosen, treat as cancel.
      setTimeout(() => { if (!input.files || !input.files.length) finish(null); }, 500);
    };
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return finish(null);
      try { finish(await file.text()); }
      catch (e) { console.error("Color Scheme Manager: file read failed", e); finish(null); }
    });
    document.body.appendChild(input);
    window.addEventListener("focus", onFocus);
    input.click();
  });
}

// Push a prebuilt palette into the live native picker + save. Mirrors the
// official Palette Loader: write with ea.viewUpdateScene and persist via
// addElementsToView. We also set ea.colorPalette explicitly so the scene
// serialization can't fall back to an empty palette (which made the picker
// show only the selected element's color).
function loadPaletteToPicker(palette) {
  if (!ea.targetView) {
    new Notice("No active Excalidraw view.");
    return;
  }
  let colorPalette;
  try {
    colorPalette = palette || paletteForAll();
  } catch (e) {
    console.error("Color Scheme Manager: palette build failed", e);
    new Notice("Palette build failed — open the console (Cmd+Opt+I) for details.");
    return;
  }
  ea.clear(); // empty the element buffer so addElementsToView only saves
  ea.colorPalette = colorPalette; // guard against fallback to an empty palette
  // captureUpdate IMMEDIATELY forces the appState change to commit + re-render.
  ea.viewUpdateScene({ appState: { colorPalette }, captureUpdate: "IMMEDIATELY" });
  ea.addElementsToView(true, true); // empty buffer — this just persists the file
  if (ea.targetView.save) ea.targetView.save(false); // hard-save the palette
}

function resetPicker() {
  if (!ea.targetView) return;
  ea.getExcalidrawAPI().updateScene({ appState: { colorPalette: {} } });
}

// Sample file shown/downloaded so users know exactly what Import expects.
const SAMPLE_IMPORT = `# ===========================================================================
# Color Scheme Manager — IMPORT TEMPLATE
# ===========================================================================
# Two ways to import. Pick ONE.
#
# Excalidraw has THREE colour pickers. This script treats them as:
#   STROKE  -> the element "Stroke" picker
#   FILL    -> the element "Background/Fill" picker
#   CANVAS  -> the page background. ALWAYS white in this script (not editable),
#              so you never specify it.
#
# Each picker shows a grid of up to 15 swatches = 3 ROWS x 5 COLUMNS, and each
# swatch automatically gets a light->dark shade ramp. The first 5 you list are
# row 1, the next 5 are row 2, the next 5 are row 3.
#
# ---------------------------------------------------------------------------
# OPTION A — SIMPLE (one flat list, the script derives stroke + fill for you)
# ---------------------------------------------------------------------------
# Just paste 2+ hex colours (spaces / commas / new lines; "#" optional).
#   2-5 colours -> a scheme (1st = stroke, 2nd = fill), auto-expanded to 15.
#   6+ colours  -> a theme (first 10 used). Stroke = your colours + dark shades,
#                  Fill = lighter tints of the same. Example:
#
#   5E81AC 81A1C1 88C0D0 8FBCBB A3BE8C B48EAD BF616A D08770 EBCB8B 4C566A
#
# ---------------------------------------------------------------------------
# OPTION B — FULL CONTROL (label each picker; this is what differentiates them)
# ---------------------------------------------------------------------------
# Use the labelled keys below. Remove the "#" example above and edit these.
# STROKE/FILL take up to 15 colours each (3 rows of 5). TOPPICKS_* are the 5
# quick swatches shown before the grid is opened (optional). "transparent",
# "black" and "white" are allowed as colour names.

NAME: My Full Theme
CATEGORY: Custom

# --- STROKE picker: 15 colours = 3 rows x 5 columns ---
STROKE:
1E1E1E 5E81AC 81A1C1 88C0D0 8FBCBB
A3BE8C B48EAD BF616A D08770 EBCB8B
4C566A 2E3440 3B4252 434C5E D8DEE9

# --- FILL picker: 15 colours = 3 rows x 5 columns ---
FILL:
transparent D8DEE9 E5E9F0 ECEFF4 C0D0E0
CFE8CF E8D6E8 F4C7C3 F5D9C8 F7ECC9
EBEEF3 C2C9D6 CDD3DE D6DBE5 B9C2D0

# --- Top-pick rows: 5 colours each (optional) ---
TOPPICKS_STROKE: black 5E81AC BF616A A3BE8C EBCB8B
TOPPICKS_FILL: transparent E5E9F0 F4C7C3 CFE8CF F7ECC9
`;

function downloadSampleImport() {
  try {
    const blob = new Blob([SAMPLE_IMPORT], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "color-scheme-import-sample.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    new Notice("Saved color-scheme-import-sample.txt to your Downloads folder.");
  } catch (e) {
    console.error("Color Scheme Manager: sample download failed", e);
    new Notice("Could not download the sample — see console.");
  }
}

// Export the drawing's CURRENT live colour picker palette (appState.colorPalette)
// as JSON — copies to the clipboard and downloads a file. This is the raw
// appState palette you can re-import (Option C) or share.
async function exportCurrentPalette() {
  if (!ea.targetView) {
    new Notice("No active Excalidraw view.");
    return;
  }
  let pal = {};
  try {
    pal = ea.getExcalidrawAPI().getAppState().colorPalette || {};
  } catch (e) {
    console.error("Color Scheme Manager: could not read colorPalette", e);
  }
  if (!pal || !Object.keys(pal).length) {
    new Notice("This drawing has no custom palette yet — apply a scheme first, then export.");
    return;
  }
  const json = JSON.stringify({ colorPalette: pal }, null, 2);
  let copied = false;
  try {
    await navigator.clipboard.writeText(json);
    copied = true;
  } catch (e) {
    /* clipboard may be unavailable; fall back to download only */
  }
  try {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "color-palette-appstate.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    new Notice(`Exported current palette${copied ? " (copied to clipboard + " : " ("}saved to Downloads).`);
  } catch (e) {
    console.error("Color Scheme Manager: palette export failed", e);
    new Notice(copied ? "Palette JSON copied to clipboard." : "Export failed — see console.");
  }
}

// ------------------------------------------------------------------
// Apply a scheme to the canvas (smart: selection vs. active color)
// ------------------------------------------------------------------
const FILLABLE = ["rectangle", "ellipse", "diamond"];

async function applyScheme(scheme) {
  if (!ea.targetView) {
    new Notice("No active Excalidraw view.");
    return;
  }
  const api = ea.getExcalidrawAPI();

  // MindMap mode: when the toggle is on and the MindMap Builder API is present,
  // recolour the whole map per-branch and DON'T uniformly recolour the
  // selection (which would paint everything one colour).
  const mmbMode = mmbSync && mmbReady();

  if (mmbMode) {
    // Set active colour for any new shapes, but leave existing elements to the
    // per-branch recolour below.
    api.updateScene({
      appState: { currentItemStrokeColor: scheme.stroke, currentItemBackgroundColor: scheme.fill },
    });
  } else {
    ea.clear();
    // MindMap mode OFF -> never touch mind map elements, even if the plugin has
    // the root node selected. Exclude them from the selection recolour.
    const mmIds = mindmapElementIds();
    const selected = ea.getViewSelectedElements().filter((el) => !mmIds.has(el.id));
    if (selected.length > 0) {
      // Recolor the selected elements (uniform stroke/fill).
      ea.copyViewElementsToEAforEditing(selected);
      for (const el of ea.getElements()) {
        el.strokeColor = scheme.stroke;
        if (FILLABLE.includes(el.type)) el.backgroundColor = scheme.fill;
      }
      await ea.addElementsToView(false, false);
      // Canvas background is left untouched (always white, never themed).
    } else {
      // Nothing selected — set the active color for the next drawn elements.
      api.updateScene({
        appState: {
          currentItemStrokeColor: scheme.stroke,
          currentItemBackgroundColor: scheme.fill,
        },
      });
    }
  }

  // Refresh the native picker: explicit picker spec > theme accents > analogous.
  loadPaletteToPicker(buildSchemePalette(scheme));

  // MindMap mode: recolour the whole map, each branch a different palette colour.
  if (mmbMode) await applyToMindMap(scheme);

  // Mark this scheme active and refresh the panel so the indicator updates.
  setActive(scheme.name);
  if (renderPanel) renderPanel();
}

// ------------------------------------------------------------------
// Side panel UI
// ------------------------------------------------------------------
function swatch(parent, color, tooltip) {
  const d = parent.createDiv();
  d.style.width = "22px";
  d.style.height = "22px";
  d.style.borderRadius = "4px";
  d.style.cursor = "pointer";
  d.style.flex = "0 0 auto";
  d.style.border = "1px solid var(--background-modifier-border)";
  if (color === "transparent" || !color) {
    d.style.backgroundImage =
      "linear-gradient(45deg,#808080 25%,transparent 25%),linear-gradient(-45deg,#808080 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#808080 75%),linear-gradient(-45deg,transparent 75%,#808080 75%)";
    d.style.backgroundSize = "8px 8px";
    d.style.backgroundPosition = "0 0,0 4px,4px -4px,-4px 0px";
  } else {
    d.style.backgroundColor = color;
  }
  if (tooltip) d.setAttribute("aria-label", tooltip);
  return d;
}

let renderPanel; // forward declaration

// ------------------------------------------------------------------
// Customize-picker editor: hand-pick the exact stroke/fill grids and the
// top-pick rows for a scheme, with reorder / add / remove and a live preview.
// Saving stores scheme.picker; "Reset to auto" clears it.
// ------------------------------------------------------------------
class PickerEditor extends ea.obsidian.Modal {
  constructor(scheme) {
    super(ea.plugin.app);
    this.scheme = scheme;
    const b = effectiveBases(scheme);
    this.stroke = b.stroke.slice(0, 15);
    this.fill = b.fill.slice(0, 15);
    this.topStroke = (b.topStroke.length ? b.topStroke : this.stroke).slice(0, 5);
    this.topFill = (b.topFill.length ? b.topFill : this.fill).slice(0, 5);
  }

  onOpen() {
    this.modalEl.style.width = "min(560px, 92vw)";
    this.render();
  }

  // A horizontal preview strip of the colours in `arr`.
  preview(parent, arr) {
    const strip = parent.createDiv();
    strip.style.display = "flex";
    strip.style.flexWrap = "wrap";
    strip.style.gap = "3px";
    strip.style.margin = "4px 0 8px";
    arr.forEach((c) => {
      const s = swatch(strip, c);
      s.style.width = "18px";
      s.style.height = "18px";
      s.style.cursor = "default";
    });
    if (!arr.length) strip.createEl("span", { text: "(empty)", attr: { style: "color:var(--text-muted);font-size:0.8em;" } });
  }

  // Render one editable list (grid up to `max`, or a top-pick row of 5).
  list(parent, arr, paletteType, max, label) {
    const sec = parent.createDiv();
    sec.style.margin = "10px 0";
    const head = sec.createDiv();
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.gap = "8px";
    head.createEl("b", { text: `${label} (${arr.length}/${max})` });
    new ea.obsidian.ButtonComponent(head)
      .setButtonText("+ Add colour")
      .onClick(async () => {
        if (arr.length >= max) {
          new Notice(`That list is full (max ${max}).`);
          return;
        }
        const picked = await ea.showColorPicker(head, paletteType);
        if (picked) {
          arr.push(picked === "transparent" ? "transparent" : picked);
          this.render();
        }
      });

    this.preview(sec, arr);

    const move = (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
      const [m] = arr.splice(from, 1);
      arr.splice(to, 0, m);
      this.render();
    };

    arr.forEach((color, i) => {
      const row = sec.createDiv();
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.padding = "3px 4px";
      row.style.borderRadius = "4px";
      row.draggable = true;

      // Drag to reorder.
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(i));
        e.dataTransfer.effectAllowed = "move";
        row.style.opacity = "0.4";
      });
      row.addEventListener("dragend", () => { row.style.opacity = "1"; });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        row.style.borderTop = "2px solid var(--interactive-accent)";
      });
      row.addEventListener("dragleave", () => { row.style.borderTop = ""; });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.style.borderTop = "";
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (!Number.isNaN(from)) move(from, i);
      });

      const grip = row.createEl("span", { text: "⠿" });
      grip.setAttribute("aria-label", "Drag to reorder");
      grip.style.cursor = "grab";
      grip.style.color = "var(--text-muted)";
      grip.style.fontSize = "1.05em";

      const sw = swatch(row, color, "Click to change this colour");
      sw.addEventListener("click", async () => {
        const picked = await ea.showColorPicker(sw, paletteType);
        if (picked) {
          arr[i] = picked === "transparent" ? "transparent" : picked;
          this.render();
        }
      });

      const lbl = row.createEl("span", { text: String(i + 1).padStart(2, "0") + "  " + color });
      lbl.style.flex = "1 1 auto";
      lbl.style.fontSize = "0.8em";
      lbl.style.color = "var(--text-muted)";

      new ea.obsidian.ButtonComponent(row).setIcon("x").setTooltip("Remove").onClick(() => { arr.splice(i, 1); this.render(); });
    });
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: `Customize picker — ${this.scheme.name}` });
    contentEl.createEl("p", {
      text: "Hand-pick the swatches for the Stroke and Fill pickers (grids up to 15 = 3×5) plus the 5 quick-pick top rows. Drag the ⠿ handle to reorder, click a swatch to change it, ✕ to remove. '↺ Revert to default' restores this scheme's built-in colours; 'Load from theme…' copies another theme's colours in. Canvas stays white.",
      attr: { style: "color:var(--text-muted);font-size:0.82em;margin-top:0;" },
    });

    this.list(contentEl, this.stroke, "elementStroke", 15, "Stroke grid");
    this.list(contentEl, this.fill, "elementBackground", 15, "Fill grid");
    this.list(contentEl, this.topStroke, "elementStroke", 5, "Stroke top-picks");
    this.list(contentEl, this.topFill, "elementBackground", 5, "Fill top-picks");

    const footer = contentEl.createDiv();
    footer.style.display = "flex";
    footer.style.flexWrap = "wrap";
    footer.style.gap = "6px";
    footer.style.marginTop = "14px";

    new ea.obsidian.ButtonComponent(footer)
      .setButtonText("Save")
      .setCta()
      .onClick(() => {
        if (!this.stroke.length && !this.fill.length) {
          new Notice("Add at least one colour to a grid.");
          return;
        }
        this.scheme.picker = {
          stroke: this.stroke.slice(),
          fill: this.fill.slice(),
          topStroke: this.topStroke.slice(),
          topFill: this.topFill.slice(),
        };
        // Row-preview colours: skip transparent/black/white anchors.
        if (this.stroke.length) this.scheme.stroke = firstRealColor(this.stroke);
        if (this.fill.length) this.scheme.fill = firstRealColor(this.fill);
        saveSchemes();
        if (activeScheme === this.scheme.name) loadPaletteToPicker(buildSchemePalette(this.scheme));
        this.close();
        renderPanel();
        new Notice(`Saved custom picker for "${this.scheme.name}".`);
      });

    // Full revert: restore a built-in scheme to its catalog colours (stroke /
    // fill / accents) and drop any custom picker. For user schemes it just
    // clears the picker. Re-seeds the editor so you can see/tweak the result.
    new ea.obsidian.ButtonComponent(footer)
      .setButtonText("↺ Revert to default")
      .setTooltip("Restore this scheme's original (built-in) colours and clear the custom picker")
      .onClick(() => {
        const cat = catalogDefault(this.scheme.name);
        delete this.scheme.picker;
        if (cat) {
          this.scheme.stroke = cat.stroke;
          this.scheme.fill = cat.fill;
          this.scheme.bg = "#ffffff";
          if (cat.accents) this.scheme.accents = cat.accents.slice();
        }
        saveSchemes();
        const ab = autoBases(this.scheme);
        this.stroke = ab.stroke.slice(0, 15);
        this.fill = ab.fill.slice(0, 15);
        this.topStroke = this.stroke.slice(0, 5);
        this.topFill = this.fill.slice(0, 5);
        if (activeScheme === this.scheme.name) loadPaletteToPicker(buildSchemePalette(this.scheme));
        renderPanel();
        this.render();
        new Notice(
          cat
            ? `"${this.scheme.name}" reverted to its built-in default colours.`
            : `"${this.scheme.name}" reset to the auto palette (no built-in default to restore).`
        );
      });

    // Build helper: seed the editor lists from any theme's default colours.
    new ea.obsidian.ButtonComponent(footer)
      .setButtonText("Load from theme…")
      .setTooltip("Copy another theme's default colours into the editor as a starting point")
      .onClick(async () => {
        const choice = await utils.suggester(schemes.map((s) => s.name), schemes, "Load colours from which theme?");
        if (!choice) return;
        const ab = autoBases(choice);
        this.stroke = ab.stroke.slice(0, 15);
        this.fill = ab.fill.slice(0, 15);
        this.topStroke = this.stroke.slice(0, 5);
        this.topFill = this.fill.slice(0, 5);
        this.render();
      });

    new ea.obsidian.ButtonComponent(footer).setButtonText("Cancel").onClick(() => this.close());
  }
}

function renderRow(contentEl, scheme, index) {
  const row = contentEl.createDiv();
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "6px";
  row.style.padding = "4px 2px";
  row.style.borderBottom = "1px solid var(--background-modifier-border)";

  // Name — click to apply the whole scheme.
  const nameEl = row.createEl("div", { text: scheme.name });
  nameEl.style.flex = "1 1 auto";
  nameEl.style.cursor = "pointer";
  nameEl.style.fontWeight = "500";
  nameEl.style.overflow = "hidden";
  nameEl.style.textOverflow = "ellipsis";
  nameEl.style.whiteSpace = "nowrap";
  nameEl.setAttribute("aria-label", "Apply this scheme");
  nameEl.addEventListener("click", () => applyScheme(scheme));

  // Active-scheme indicator.
  if (activeScheme && scheme.name === activeScheme) {
    row.style.background = "var(--background-modifier-hover)";
    row.style.borderRadius = "4px";
    nameEl.style.color = "var(--text-accent)";
    nameEl.textContent = "▸ " + scheme.name;
  }

  // Three editable swatches.
  const slots = [
    { key: "stroke", palette: "elementStroke",     label: "Stroke" },
    { key: "fill",   palette: "elementBackground",  label: "Fill" },
    { key: "bg",     palette: "canvasBackground",   label: "Canvas background" },
  ];
  for (const slot of slots) {
    const sw = swatch(row, scheme[slot.key], `${slot.label} — click to change`);
    sw.addEventListener("click", async () => {
      const picked = await pickColor(sw, slot.palette, scheme[slot.key]);
      if (picked && picked !== scheme[slot.key]) {
        scheme[slot.key] = picked;
        saveSchemes();
        renderPanel();
      }
    });
  }

  // Customize picker — hand-pick the exact swatches / order / top-picks.
  new ea.obsidian.ButtonComponent(row)
    .setIcon("sliders-horizontal")
    .setTooltip("Customize picker (hand-pick colours & order)")
    .onClick(() => new PickerEditor(scheme).open());

  // Rename / recategorize.
  new ea.obsidian.ButtonComponent(row)
    .setIcon("pencil")
    .setTooltip("Rename / change category")
    .onClick(async () => {
      const newName = await utils.inputPrompt("Rename scheme", "Scheme name", scheme.name);
      if (newName === undefined) return; // cancelled
      if (newName && newName.trim()) scheme.name = newName.trim();
      scheme.category = await pickCategory(scheme.category || "Custom");
      saveSchemes();
      renderPanel();
    });

  // Delete.
  new ea.obsidian.ButtonComponent(row)
    .setIcon("trash")
    .setTooltip("Delete")
    .onClick(async () => {
      const confirmed = await utils.suggester(
        ["Cancel", `Delete "${scheme.name}"`],
        [false, true],
        `Delete scheme "${scheme.name}"?`
      );
      if (confirmed) {
        schemes.splice(index, 1);
        saveSchemes();
        renderPanel();
      }
    });
}

ea.createSidepanelTab("Color Schemes", false, true).then((tab) => {
  if (!tab) return;

  renderPanel = () => {
    const contentEl = tab.contentEl;
    contentEl.empty();

    // Header: title + ℹ️ info button that toggles the About description.
    const header = contentEl.createDiv();
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "6px";
    const h2 = header.createEl("h2", { text: "Color Schemes" });
    h2.style.margin = "0";
    h2.style.flex = "1 1 auto";

    const about = contentEl.createDiv();
    about.style.display = "none";
    about.style.background = "var(--background-secondary)";
    about.style.padding = "8px 10px";
    about.style.borderRadius = "6px";
    about.style.margin = "8px 0";
    about.style.fontSize = "0.82em";
    try {
      ea.obsidian.MarkdownRenderer.render(ea.plugin.app, ABOUT, about, "", ea.plugin);
    } catch (e) {
      about.setText(ABOUT);
    }

    new ea.obsidian.ButtonComponent(header)
      .setIcon("info")
      .setTooltip("About this script")
      .onClick(() => {
        about.style.display = about.style.display === "none" ? "block" : "none";
      });

    if (!schemes.length) {
      contentEl.createEl("p", {
        text: "No schemes yet — create one below.",
        attr: { style: "color: var(--text-warning);" },
      });
    }

    // Category filter dropdown.
    const cats = categoryList();
    if (!cats.includes(selectedCategory)) selectedCategory = "All";
    new ea.obsidian.Setting(contentEl)
      .setName("Category")
      .setDesc("Filter the schemes below")
      .addDropdown((dd) => {
        cats.forEach((c) => dd.addOption(c, c));
        dd.setValue(selectedCategory);
        dd.onChange((v) => {
          setCategory(v);
          renderPanel();
        });
      });

    // MindMap Builder sync — only shown when that script's API is available, so
    // the panel stays clean for standalone use.
    if (mmbReady()) {
      new ea.obsidian.Setting(contentEl)
        .setName("MindMap mode")
        .setDesc("When on, picking a theme recolours the active mind map — each branch a different theme colour")
        .addToggle((tg) => {
          tg.setValue(mmbSync);
          tg.onChange((v) => {
            setMmbSync(v);
            new Notice(v ? "MindMap mode ON — themes now recolour the mind map." : "MindMap mode OFF — themes apply to the canvas only.");
          });
        });
    }

    // Special "Default" row — resets the picker to Excalidraw's defaults.
    const resetRow = contentEl.createDiv();
    resetRow.style.display = "flex";
    resetRow.style.alignItems = "center";
    resetRow.style.padding = "4px 2px";
    resetRow.style.borderBottom = "1px solid var(--background-modifier-border)";
    const resetName = resetRow.createEl("div", {
      text: (activeScheme ? "↺ Default (reset palette)" : "▸ ↺ Default (reset palette)"),
    });
    resetName.style.cursor = "pointer";
    resetName.style.fontWeight = "500";
    resetName.style.color = "var(--text-accent)";
    if (!activeScheme) {
      resetRow.style.background = "var(--background-modifier-hover)";
      resetRow.style.borderRadius = "4px";
    }
    resetName.setAttribute("aria-label", "Reset the colour picker to Excalidraw defaults");
    resetName.addEventListener("click", () => {
      resetPicker();
      setActive("");
      renderPanel();
    });

    const visible =
      selectedCategory === "All"
        ? schemes
        : schemes.filter((s) => (s.category || "Custom") === selectedCategory);
    visible.forEach((scheme) => renderRow(contentEl, scheme, schemes.indexOf(scheme)));

    // Action buttons.
    const actions = contentEl.createDiv();
    actions.style.marginTop = "12px";
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "6px";

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("+ New scheme")
      .setCta()
      .onClick(async () => {
        const name = await utils.inputPrompt("New scheme", "Scheme name", "My scheme");
        if (!name || !name.trim()) return;
        const anchor = actions;
        const stroke = await pickColor(anchor, "elementStroke", "#1e1e1e");
        const fill = await pickColor(anchor, "elementBackground", "transparent");
        // Auto-build a full 10-accent palette so the new scheme offers the same
        // rich 15-swatch extended picker as the built-in themes. Canvas = white.
        const accents = synthAccents(stroke, fill);
        const category = await pickCategory("Custom");
        schemes.push({ name: name.trim(), category, stroke, fill, bg: "#ffffff", accents });
        setCategory(category);
        saveSchemes();
        renderPanel();
      });

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("Import")
      .setTooltip("Create a scheme/theme from pasted colours or a .txt / .json file (e.g. an edited Sample format, or an exported palette)")
      .onClick(async () => {
        const how = await utils.suggester(
          ["📋  Paste colours", "📄  Open a .txt / .json file…"],
          ["paste", "file"],
          "Import colours from…"
        );
        if (!how) return;
        let raw;
        if (how === "file") {
          raw = await pickTextFile();
          if (!raw) return;
        } else {
          raw = await utils.inputPrompt(
            "Paste colours (see 'Sample format' button)",
            "Flat hex list, the labelled STROKE:/FILL: format, OR a raw appState colorPalette JSON",
            ""
          );
          if (!raw) return;
        }
        await importColors(raw);
      });

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("Sample format")
      .setTooltip("Download a template showing the Import format")
      .onClick(() => downloadSampleImport());

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("Export palette")
      .setTooltip("Save the drawing's current colour palette as appState JSON (clipboard + Downloads)")
      .onClick(() => exportCurrentPalette());

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("Add presets")
      .setTooltip("Add the built-in paletton-style schemes you don't already have")
      .onClick(() => {
        const have = new Set(schemes.map((s) => s.name.toLowerCase()));
        let added = 0;
        for (const p of DEFAULT_SCHEMES) {
          if (!have.has(p.name.toLowerCase())) {
            schemes.push({ ...p });
            added++;
          }
        }
        if (added) {
          saveSchemes();
          renderPanel();
        }
        new Notice(added ? `Added ${added} preset scheme(s).` : "All presets already present.");
      });

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("Save selection")
      .setTooltip("Capture colors from the selected element + current canvas background")
      .onClick(async () => {
        if (!ea.targetView) {
          new Notice("No active Excalidraw view.");
          return;
        }
        ea.clear();
        const sel = ea.getViewSelectedElements();
        if (!sel.length) {
          new Notice("Select an element first to capture its colors.");
          return;
        }
        const src = sel.find((el) => FILLABLE.includes(el.type)) || sel[0];
        const appState = ea.getExcalidrawAPI().getAppState();
        const name = await utils.inputPrompt("Save selection as scheme", "Scheme name", "Captured");
        if (!name || !name.trim()) return;
        schemes.push({
          name: name.trim(),
          stroke: src.strokeColor || "#1e1e1e",
          fill: src.backgroundColor || "transparent",
          bg: "#ffffff", // canvas background is always pure white
        });
        saveSchemes();
        renderPanel();
      });

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("Load all → picker")
      .setTooltip("Load the colors of ALL saved schemes into the native color picker")
      .onClick(() => {
        loadPaletteToPicker(paletteForAll());
        new Notice(`Loaded ${schemes.length} scheme(s) into the color picker.`);
      });

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("Reset picker")
      .setTooltip("Restore Excalidraw's default color picker palette")
      .onClick(() => resetPicker());

    new ea.obsidian.ButtonComponent(actions)
      .setButtonText("Close")
      .onClick(() => {
        if (ea.sidepanelTab) ea.sidepanelTab.close();
        ea.toggleSidepanelView();
      });
  };

  tab.onOpen = async () => {
    schemes = loadSchemes();
    renderPanel();
  };

  tab.onFocus = async (view) => {
    if (view && view !== ea.targetView) {
      ea.setView(view);
      ea.clear();
    }
  };

  tab.open();
});
