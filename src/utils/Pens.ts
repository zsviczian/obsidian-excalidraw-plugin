import { PenStyle, PenType } from "src/PenTypes";

export const PENS:Record<PenType,PenStyle> = {
  "default": {
    type: "default",
    freedrawOnly: false,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 0,
    roughness: 0,
    penOptions: {
      highlighter: false,
      constantPressure: false,
      hasOutline: false,
      outlineWidth: 1,
      options: {
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.5,
        easing: "easeOutSine",
        start: {
          cap: true,
          taper: 0,
          easing: "linear"
        },
        end: {
          cap: true,
          taper: 0,
          easing: "linear"
        }
      }
    }
  },
  "highlighter": {
    type: "highlighter",
    freedrawOnly: true,
    strokeColor: "#FFC47C",
    backgroundColor: "#FFC47C",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: null,
    penOptions: {
      highlighter: true,
      constantPressure: true,
      hasOutline: true,
      outlineWidth: 4,
      options: {
        thinning: 1,
        smoothing: 0.5,
        streamline: 0.5,
        easing: "linear",
        start: {
          taper: 0,
          cap: true,
          easing: "linear"
        },
        end: {
          taper: 0,
          cap: true,
          easing: "linear"
        }
      }
    }
  },
  "finetip": {
    type: "finetip",
    freedrawOnly: false,
    strokeColor: "#3E6F8D",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 0.5,
    roughness: 0,
    penOptions: {
      highlighter: false,
      hasOutline: false,
      outlineWidth: 1,
      constantPressure: true,
      options: {
        smoothing: 0.4,
        thinning: -0.5,
        streamline: 0.4,
        easing: "linear",
        start: {
          taper: 5,
          cap: false,
          easing: "linear"
        },
        end: {
          taper: 5,
          cap: false,
          easing:"linear"
        },
      }
    }
  },
  "fountain": {
    type: "fountain",
    freedrawOnly: false,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 2,
    roughness: 0,
    penOptions: {
      highlighter: false,
      constantPressure: false,
      hasOutline: false,
      outlineWidth: 1,
      options: {
        smoothing: 0.2,
        thinning: 0.6,
        streamline: 0.2,
        easing: "easeInOutSine",
        start: {
          taper: 150,
          cap: true,
          easing: "linear"
        },
        end: {
          taper: 1,
          cap: true,
          easing: "linear"
        },
      }
    }
  },
  "marker": {
    type: "marker",
    freedrawOnly: true,
    strokeColor: "#B83E3E",
    backgroundColor: "#FF7C7C",
    fillStyle: "dashed",
    strokeWidth: 2,
    roughness: 3,
    penOptions: {
      highlighter: false,
      constantPressure: true,
      hasOutline: true,
      outlineWidth: 4,
      options: {
        thinning: 1,
        smoothing: 0.5,
        streamline: 0.5,
        easing: "linear",
        start: {
          taper: 0,
          cap: true,
          easing: "linear"
        },
        end: {
          taper: 0,
          cap: true,
          easing: "linear"
        }
      }
    }
  },
  "thick-thin": {
    type: "thick-thin",
    freedrawOnly: true,
    strokeColor: "#CECDCC",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 0,
    roughness: null,
    penOptions: {
      highlighter: true,
      constantPressure: true,
      hasOutline: false,
      outlineWidth: 1,
      options: {
        thinning: 1,
        smoothing: 0.5,
        streamline: 0.5,
        easing: "linear",
        start: {
          taper: 0,
          cap: true,
          easing: "linear"
        },
        end: {
          cap: true,
          taper: true,
          easing: "linear",
        }
      }
    }
  },
  "thin-thick-thin": {
    type: "thin-thick-thin",
    freedrawOnly: true,
    strokeColor: "#CECDCC",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 0,
    roughness: null,
    penOptions: {
      highlighter: true,
      constantPressure: true,
      hasOutline: false,
      outlineWidth: 1,
      options: {
        thinning: 1,
        smoothing: 0.5,
        streamline: 0.5,
        easing: "linear",
        start: {
          cap: true,
          taper: true,
          easing: "linear",
        },
        end: {
          cap: true,
          taper: true,
          easing: "linear",
        }
      }
    }
  },
}
