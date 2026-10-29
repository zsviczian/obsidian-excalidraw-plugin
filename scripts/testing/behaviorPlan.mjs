/** Reviewed behavioral factor domains, explicit expected precedence and host-context obligations. */
import { pairwise } from "./pairwise.mjs";

export const behaviorContexts = [
  "main",
  "split",
  "nested-split",
  "popout",
  "phone",
  "tablet",
];
export const settingsFactors = {
  defaultMode: ["normal", "view", "zen"],
  frontMode: ["missing", "normal", "view", "zen"],
  linkOpacity: [0, 0.35, 1],
  frontOpacity: ["missing", 0, 1],
  showLinkBrackets: [false, true],
  frontBrackets: ["missing", false, true],
};
export const settingsCases = pairwise(settingsFactors, [
  {
    defaultMode: "view",
    frontMode: "normal",
    linkOpacity: 1,
    frontOpacity: 0,
    showLinkBrackets: true,
    frontBrackets: false,
  },
  {
    defaultMode: "zen",
    frontMode: "missing",
    linkOpacity: 0,
    frontOpacity: "missing",
    showLinkBrackets: false,
    frontBrackets: "missing",
  },
]).map((values, i) => ({
  id: "settings-" + String(i + 1).padStart(2, "0"),
  values,
  expected: {
    mode:
      values.frontMode === "missing" ? values.defaultMode : values.frontMode,
    opacity:
      values.frontOpacity === "missing"
        ? values.linkOpacity
        : values.frontOpacity,
    brackets:
      values.frontBrackets === "missing"
        ? values.showLinkBrackets
        : values.frontBrackets,
  },
  assertions: [
    "global defaults apply when frontmatter is missing",
    "frontmatter overrides conflicting settings including false and zero",
    "loaded editor mode agrees with resolver",
    "frontmatter and scene survive save/reopen",
  ],
}));
export const exportFactors = {
  withBackground: [false, true],
  padding: [0, 10],
  frontTransparent: ["missing", false, true],
  frontPadding: ["missing", 0, 6],
  frontDark: ["missing", false, true],
};
export const exportCases = pairwise(exportFactors, [
  {
    withBackground: true,
    padding: 10,
    frontTransparent: true,
    frontPadding: 0,
    frontDark: false,
  },
  {
    withBackground: false,
    padding: 0,
    frontTransparent: false,
    frontPadding: "missing",
    frontDark: true,
  },
]).map((values, i) => ({
  id: "export-" + String(i + 1).padStart(2, "0"),
  values,
  expected: {
    background:
      values.frontTransparent === "missing"
        ? values.withBackground
        : !values.frontTransparent,
    padding:
      values.frontPadding === "missing" ? values.padding : values.frontPadding,
    theme: values.frontDark === true ? "dark" : "light",
  },
  assertions: [
    "frontmatter background/theme/padding precedence",
    "zero padding and explicit false are preserved",
    "actual SVG geometry and decoded PNG alpha/color",
    "saved/reopened scene identity",
  ],
}));

export const workflowCases = [
  {
    id: "export-frame-padding-policy",
    features: ["P06", "P09"],
    assertions: [
      "default frame rendering suppresses padding, including scenes without frames",
      "disabling frame rendering enables the requested padding",
      "actual SVG and decoded PNG dimensions agree",
      "saved scene survives reopen",
    ],
  },
  {
    id: "cli-atomic-targeted-edit",
    features: ["P03", "P07", "P10"],
    assertions: [
      "actual plugin CLI read/apply transport",
      "explicit target survives another active drawing",
      "zero/false values reach disk",
      "invalid mixed request is atomic",
      "save/reopen preserves edited scene",
    ],
  },
  {
    id: "settings-live-persistence",
    features: ["P06"],
    assertions: [
      "live settings reads",
      "physical data.json",
      "unknown setting retention",
      "restoration",
    ],
  },
  {
    id: "frontmatter-prefixes-theme-scale",
    features: ["P04", "P06", "P09"],
    assertions: [
      "empty prefixes",
      "embeddable theme",
      "PNG scale zero fallback and positive override",
      "deprecated padding precedence",
    ],
  },
  {
    id: "markdown-reading",
    features: ["P04", "P05"],
    assertions: [
      "real reading view",
      "aliases/headings/blocks",
      "table/callout/equation",
      "nested and drawing embeds",
      "decoded images",
    ],
  },
  {
    id: "markdown-live-preview",
    features: ["P04", "P05"],
    assertions: [
      "actual Live Preview mode",
      "table/callout/equation",
      "nested and drawing embeds",
      "decoded images",
    ],
  },
  {
    id: "markdown-source-edit",
    features: ["P04", "P05"],
    assertions: [
      "source edit rerenders nested content",
      "updated text and decoded output",
      "disk persistence",
    ],
  },
  {
    id: "images-shared-crops",
    features: ["P05", "P09"],
    assertions: [
      "raster/SVG references",
      "shared source distinct sizes/crops",
      "transparency",
      "physical save and reopen",
    ],
  },
  {
    id: "images-source-edit-missing",
    features: ["P05"],
    assertions: [
      "source edits invalidate rendering",
      "missing asset has an explicit outcome",
      "asynchronous completion",
      "restoration",
    ],
  },
  {
    id: "drawing-and-markdown-embeds",
    features: ["P05", "P09"],
    assertions: [
      "drawing and Markdown rendered images",
      "local embeddable target",
      "decoded export content",
      "save/reopen",
    ],
  },
  {
    id: "raw-parsed-text",
    features: ["P04"],
    assertions: [
      "raw text preserved",
      "parsed alias display",
      "headings/block references",
      "mode round trip and persistence",
    ],
  },
  {
    id: "ea-selection-groups-bindings-frames",
    features: ["P07", "P10"],
    assertions: [
      "public EA creation/edit/selection/group/frame/binding APIs",
      "scene and disk relationships",
      "workbench isolation",
    ],
  },
  {
    id: "ea-hooks-targeting-invalid",
    features: ["P03", "P10"],
    assertions: [
      "correct drawing and owning window",
      "hooks run with their target",
      "disposal",
      "invalid input does not partially mutate",
      "custom data survives save/reopen",
    ],
  },
  {
    id: "command-palette-selection-cancel",
    features: ["P07"],
    assertions: [
      "trusted palette search and selection",
      "observable command effect",
      "Escape cancellation leaves scene unchanged",
    ],
  },
  {
    id: "toolbar-context-shortcuts",
    features: ["P07"],
    assertions: [
      "trusted toolbar and context menu",
      "keyboard shortcut and cancellation",
      "scene state and on-disk save",
    ],
  },
];

export function behavioralCases(contexts = behaviorContexts) {
  return contexts.flatMap((context) => [
    ...settingsCases.map((row) => ({
      ...row,
      context,
      testId: "native:behavior:" + context + ":" + row.id,
      featureIds: ["P06"],
    })),
    ...exportCases.map((row) => ({
      ...row,
      context,
      testId: "native:behavior:" + context + ":" + row.id,
      featureIds: ["P06", "P09"],
    })),
    ...workflowCases.map((row) => ({
      ...row,
      context,
      testId: "native:behavior:" + context + ":" + row.id,
      featureIds: row.features,
    })),
  ]);
}
