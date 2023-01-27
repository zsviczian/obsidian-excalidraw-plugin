import { ExcalidrawImperativeAPI } from "@zsviczian/excalidraw/types/types";
import { ColorComponent, Modal, Setting, SliderComponent, ToggleComponent } from "obsidian";
import { VIEW_TYPE_EXCALIDRAW } from "src/Constants";
import ExcalidrawView from "src/ExcalidrawView";
import ExcalidrawPlugin from "src/main";
import { ExtendedFillStyle, PenStyle, PenType } from "src/PenTypes";
import { PENS } from "src/utils/Pens";
import { fragWithHTML, getExportPadding, getExportTheme, getPNGScale, getWithBackground } from "src/utils/Utils";

const EASINGFUNCTIONS: Record<string,string> = {
  linear: "linear",
  easeInQuad: "easeInQuad",
  easeOutQuad: "easeOutQuad",
  easeInOutQuad: "easeInOutQuad",
  easeInCubic: "easeInCubic",
  easeOutCubic: "easeOutCubic",
  easeInOutCubic: "easeInOutCubic",
  easeInQuart: "easeInQuart",
  easeOutQuart: "easeOutQuart",
  easeInOutQuart: "easeInOutQuart",
  easeInQuint: "easeInQuint",
  easeOutQuint: "easeOutQuint",
  easeInOutQuint: "easeInOutQuint",
  easeInSine: "easeInSine",
  easeOutSine: "easeOutSine",
  easeInOutSine: "easeInOutSine",
  easeInExpo: "easeInExpo",
  easeOutExpo: "easeOutExpo",
  easeInOutExpo: "easeInOutExpo",
  easeInCirc: "easeInCirc",
  easeOutCirc: "easeOutCirc",
  easeInOutCirc: "easeInOutCirc",
  easeInBack: "easeInBack",
  easeOutBack: "easeOutBack",
  easeInOutBack: "easeInOutBack",
  easeInElastic: "easeInElastic",
  easeOutElastic: "easeOutElastic",
  easeInOutElastic: "easeInOutElastic",
  easeInBounce: "easeInBounce",
  easeOutBounce: "easeOutBounce",
  easeInOutBounce: "easeInOutBounce",
};

export class PenSettingsModal extends Modal {
  private api: ExcalidrawImperativeAPI;
  private dirty: boolean = false;

  constructor(
    private plugin: ExcalidrawPlugin,
    private view: ExcalidrawView,
    private pen: number,
  ) {
    super(app);
    this.api = view.excalidrawAPI;

  }

  onOpen(): void {
    this.containerEl.classList.add("excalidraw-release");
    this.titleEl.setText(`Pen Settings`);
    this.createForm();
  }

  async onClose() {
    if(this.dirty) {
      app.workspace.getLeavesOfType(VIEW_TYPE_EXCALIDRAW).forEach(v=> {
        if (v.view instanceof ExcalidrawView) v.view.updatePinnedCustomPens()
      })
      this.plugin.saveSettings();
      const pen = this.plugin.settings.customPens[this.pen]
      const api = this.view.excalidrawAPI;
      const st = api.getAppState();
      api.updateScene({
        appState: {
          currentStrokeOptions: pen.penOptions,
          ...(!pen.strokeWidth || (pen.strokeWidth === 0)) ? null : {currentItemStrokeWidth: pen.strokeWidth},
          ...pen.backgroundColor ? {currentItemBackgroundColor: pen.backgroundColor} : null,
          ...pen.strokeColor ? {currentItemStrokeColor: pen.strokeColor} : null,
          ...pen.fillStyle === "" ? null : {currentItemFillStyle: pen.fillStyle},
          ...pen.roughness ? null : {currentItemRoughness: pen.roughness},
          ...pen.freedrawOnly ? {resetCustomPen: {
            currentItemStrokeWidth: st.currentItemStrokeWidth,
            currentItemBackgroundColor: st.currentItemBackgroundColor,
            currentItemStrokeColor: st.currentItemStrokeColor,
            currentItemFillStyle: st.currentItemFillStyle,
            currentItemRoughness: st.currentItemRoughness,
          }} : {}
        }
      });
      api.setActiveTool({type:"freedraw"});
      
    }
    
  }

  async createForm() {
    const ps = this.plugin.settings.customPens[this.pen]
    const ce = this.contentEl;
    
    ce.createEl("h1",{text: "Pen settings"});

    new Setting(ce)
      .setName("Pen type")
      .setDesc("Select type of pen")
      .addDropdown(dropdown => {
        dropdown
          .addOption("default", "Excalidraw Default")
          .addOption("highlighter", "Highlighter")
          .addOption("finetip", "Fine tip pen")
          .addOption("fountain", "Fountain pen")
          .addOption("marker", "Marker with Outline")
          .addOption("thick-thin", "Mindmap Thick-Thin")
          .addOption("thin-thick-thin", "Mindmap Thin-Thick-Thin")
          .setValue(ps.type)
          .onChange((value:PenType) => {
            this.dirty = true;
            ps.type = value;
          })
      })
      .addButton(button =>
        button
          .setButtonText("Apply")
          .onClick(()=> {
            this.dirty = true;
            ps.strokeColor = PENS[ps.type].strokeColor;
            ps.backgroundColor = PENS[ps.type].backgroundColor;
            ps.fillStyle = PENS[ps.type].fillStyle;
            ps.strokeWidth = PENS[ps.type].strokeWidth;
            ps.roughness = PENS[ps.type].roughness;
            ps.penOptions = {...PENS[ps.type].penOptions};
            ce.empty();
            this.createForm();
          })
        )
    
    let scopeSetting: Setting;

    scopeSetting = new Setting(ce)
      .setName(fragWithHTML(ps.freedrawOnly?"Stroke & fill applies to: <b>Freedraw only</b>":"Stroke & fill applies to: <b>All shapes</b>"))
      .setDesc(fragWithHTML(`In practical terms <b>all shapes</b> means that if I set a blue pen with dashed fill, and after drawing a freedraw line I switch tools and draw a circle or an arrow, it will have the same blue line and dashed fill.<br>If on the other hand, the style <b>only applys to the freedraw line</b> then if I have a yellow highlighter, when I switch back to drawing a rectangle, a line or a text element those will follow the style before the highlighter (e.g. black text)`))
      .addToggle(toggle =>
        toggle
          .setValue(ps.freedrawOnly)
          .onChange(value => {
            this.dirty = true;
            scopeSetting.setName(fragWithHTML(value?"Stroke & fill applies to: <b>Freedraw only</b>":"Stroke & fill applies to: <b>All shapes</b>"))
            ps.freedrawOnly = value;
          })
      )

    let scSetting: Setting;
    let scComponent: ColorComponent;
    let strokeSetting: Setting;

    strokeSetting = new Setting(ce)
      .setName(fragWithHTML(!Boolean(ps.strokeColor) ? "Stroke color: <b>Current</b>" : "Stroke color: <b>Preset color</b>"))
      .setDesc("Use current stroke color of the canvas, or set a specific color for the pen")
      .addToggle(toggle => 
        toggle
          .setValue(!Boolean(ps.strokeColor))
          .onChange(value=> {
            this.dirty = true;
            scSetting.settingEl.style.display = value ? "none" : "";
            strokeSetting.setName(fragWithHTML(value ? "Stroke color: <b>Current</b>" : "Stroke color: <b>Preset color</b>"))
            if(value) {
              delete ps.strokeColor;
            } else {
              if(!scComponent.getValue()) scComponent.setValue("#000000");
            }
          })
        )
    
    scSetting = new Setting(ce)
		  .setName("Select stroke color")
		  .addColorPicker(colorpicker => {
        scComponent = colorpicker;
        colorpicker
          .setValue(ps.strokeColor??"#000000")
          .onChange(value => {
            this.dirty = true;
            ps.strokeColor = value;
          })
        } 
		  )

    scSetting.settingEl.style.display = !Boolean(ps.strokeColor) ? "none" : "";    

    let bSetting: Setting;
    let bcSetting: Setting;
    let bctSetting: Setting;
    let bcComponent: ColorComponent;
    let btComponent: ToggleComponent;

    bSetting = new Setting(ce)
      .setName(fragWithHTML(!Boolean(ps.backgroundColor) ? "Background color: <b>Current</b>" : "Background color: <b>Preset color</b>"))
      .setDesc("Toggle to use current background color on the canvas or a pre-set color")
      .addToggle(toggle => 
        toggle
          .setValue(!Boolean(ps.backgroundColor))
          .onChange(value=> {
            this.dirty = true;
            bSetting.setName(fragWithHTML(value ? "Background color: <b>Current</b>" : "Background color: <b>Preset color</b>"))
            bctSetting.settingEl.style.display = value ? "none" : "";
            bcSetting.settingEl.style.display = (value || ps.backgroundColor==="transparent") ? "none" : "";
            if(value) {
              delete ps.backgroundColor;
            } else {
              if(!bcComponent.getValue()) bcComponent.setValue("#000000");
              btComponent.setValue(false);
            }
          })
        )


    bctSetting = new Setting(ce)
      .setName(fragWithHTML(ps.backgroundColor==="transparent" ? "Background: <b>Transparent</b>" : "Color: <b>Preset color</b>"))
      .setDesc("Background has color or is transparent")
      .addToggle(toggle => {
        btComponent = toggle;
        toggle
          .setValue(ps.backgroundColor==="transparent")
          .onChange(value => {
            this.dirty = true;
            bcSetting.settingEl.style.display = value ? "none" : "";
            bctSetting.setName(fragWithHTML(value ? "Background: <b>Transparent</b>" : "Color: <b>Preset color</b>"))
            ps.backgroundColor = value ? "transparent" : bcComponent.getValue();
          })
      }
    )
		
    bctSetting.settingEl.style.display = !Boolean(ps.backgroundColor) ? "none" : "";

    bcSetting = new Setting(ce)
		  .setName("Background color")
		  .addColorPicker(colorpicker => {
        bcComponent = colorpicker;
        colorpicker
		      .setValue(ps.backgroundColor==="transparent"?"#000000":ps.backgroundColor)
		      .onChange(value => {
		        this.dirty = true;
		        ps.backgroundColor = value;
		      }) 
        })
    
    bcSetting.settingEl.style.display = (!Boolean(ps.backgroundColor) || ps.backgroundColor==="transparent") ? "none" : "";

		new Setting(ce)
		  .setName("Fill Style")
		  .addDropdown(dropdown =>
        dropdown
          .addOption("","Unset")
          .addOption("dots","Dots (⚠ VERY SLOW performance on large objects!)")
          .addOption("zigzag","Zigzag")
          .addOption("zigzag-line","Zigzag-line")
          .addOption("dashed","Dashed")
          .addOption("hachure","Hachure")
          .addOption("cross-hatch","Cross-hatch")
          .addOption("solid","Solid")
          .setValue(ps.fillStyle)
          .onChange((value: ExtendedFillStyle) => {
            this.dirty = true;
            ps.fillStyle = value;
          }) 
		  )

    let rSetting: Setting;
    rSetting = new Setting(ce)
      .setName(fragWithHTML(`Sloppiness: <b>${ps.roughness <0 ? "Not Set" : (ps.roughness<=0.5 ? "Architect (" : (ps.roughness <= 1.5 ? "Artist (" : "Cartoonist ("))}${ps.roughness >= 0 ? `${ps.roughness})`:""}</b>`))
      .setDesc("Line sloppiness of the shape fill pattern")
      .addSlider(slider =>
        slider
          .setLimits(-0.5,3,0.5)
          .setValue(ps.roughness === null ? 0.5 : ps.roughness)
          .onChange(value => {
            this.dirty = true;
            ps.roughness = value === 0.5 ? null : value;
            rSetting.setName(fragWithHTML(`Sloppiness: <b>${ps.roughness <0 ? "Not Set" : (ps.roughness<=0.5 ? "Architect (" : (ps.roughness <= 1.5 ? "Artist (" : "Cartoonist ("))}${ps.roughness >= 0 ? `${ps.roughness})`:""}</b>`));
          })
      )

    let swSetting: Setting;

		swSetting = new Setting(ce)
		  .setName(fragWithHTML(`Stroke Width <b>${ps.strokeWidth === 0 ? "NOT SET" : ps.strokeWidth}</b>`))
      .addSlider(slider =>
        slider
          .setLimits(0,5,0.5)
          .setValue(ps.strokeWidth)
          .onChange(value => {
            this.dirty = true;
            ps.strokeWidth = value;
            swSetting.setName(fragWithHTML(`Stroke Width <b>${ps.strokeWidth === 0 ? "NOT SET" : ps.strokeWidth}</b>`));
          }) 
		  )
	
    new Setting(ce)
      .setName("Highlighter pen?")
      .addToggle(toggle => 
        toggle
          .setValue(ps.penOptions.highlighter)
          .onChange(value => {
            this.dirty = true;
            ps.penOptions.highlighter = value;
          })
      )

    new Setting(ce)
      .setName("Pressure sensitve pen?")
      .addToggle(toggle =>
        toggle
          .setValue(!ps.penOptions.constantPressure)
          .onChange(value => {
            this.dirty = true;
            ps.penOptions.constantPressure = !value;
          })
      )

    if(ps.penOptions.hasOutline && ps.penOptions.outlineWidth === 0) {
      ps.penOptions.outlineWidth = 0.5;
      this.dirty = true;
    }

    if(!ps.penOptions.hasOutline && ps.penOptions.outlineWidth > 0) {
      ps.penOptions.outlineWidth = 0;
      this.dirty = true;
    }
    
    let owSetting: Setting;

    owSetting = new Setting(ce)
      .setName(fragWithHTML(ps.penOptions.outlineWidth === 0 ? `No outline` : `Outline width <b>${ps.penOptions.outlineWidth}</b>`))
      .setDesc("If the stroke has an outline, this will mean the stroke color is the outline color, and the background color is the pen stroke's fill color. If the pen does not have an outline then the pen color is the stroke color. The Fill Style setting applies to the fill style of the enclosed shape, not of the line itself. The line can only have solid fill.")
      .addSlider(slider => 
        slider
          .setLimits(0,8,0.5)
          .setValue(ps.penOptions.outlineWidth)
          .onChange(value => {
            this.dirty = true;
            ps.penOptions.outlineWidth = value;
            ps.penOptions.hasOutline = value > 0;
            owSetting.setName(fragWithHTML(ps.penOptions.outlineWidth === 0 ? `No outline` : `Outline width <b>${ps.penOptions.outlineWidth}</b>`));
          })
       )
    

    ce.createEl("h2",{text: "Perfect Freehand settings"});
    const p = ce.createEl("p");
    p.innerHTML = `Read the Perfect Freehand documentation following <a href="https://github.com/steveruizok/perfect-freehand#documentation" target="_blank">this link</a>.`;

    let tSetting: Setting;
    tSetting = new Setting(ce)
      .setName(fragWithHTML(`Thinnning <b>${ps.penOptions.options.thinning}</b>`))
      .setDesc(fragWithHTML(`The effect of pressure on the stroke's size.<br>To create a stroke with a steady line, set the thinning option to 0.<br>To create a stroke that gets thinner with pressure instead of thicker, use a negative number for the thinning option.`))
      .addSlider(slider =>
        slider
          .setLimits(-1,1,0.01)
          .setValue(ps.penOptions.options.thinning)
          .onChange(value=> {
            this.dirty;
            tSetting.setName(fragWithHTML(`Thinnning <b>${ps.penOptions.options.thinning}</b>)`));
            ps.penOptions.options.thinning = value;
          })
        )

    let sSetting: Setting;
    sSetting = new Setting(ce)
      .setName(fragWithHTML(`Smoothing <b>${ps.penOptions.options.smoothing}</b>`))
      .setDesc(fragWithHTML(`How much to soften the stroke's edges.`))
      .addSlider(slider =>
        slider
          .setLimits(0,1,0.01)
          .setValue(ps.penOptions.options.smoothing)
          .onChange(value=> {
            this.dirty;
            sSetting.setName(fragWithHTML(`Smoothing <b>${ps.penOptions.options.smoothing}</b>`));
            ps.penOptions.options.smoothing = value;
          })
        )

    let slSetting: Setting;
    slSetting = new Setting(ce)
      .setName(fragWithHTML(`Streamline <b>${ps.penOptions.options.streamline}</b>`))
      .setDesc(fragWithHTML(`	How much to streamline the stroke.`))
      .addSlider(slider =>
        slider
          .setLimits(0,1,0.01)
          .setValue(ps.penOptions.options.streamline)
          .onChange(value=> {
            this.dirty;
            slSetting.setName(fragWithHTML(`Streamline <b>${ps.penOptions.options.streamline}</b>`));
            ps.penOptions.options.streamline = value;
          })
        )

    new Setting(ce)
    .setName("Easing function")
    .setDesc(fragWithHTML(`An easing function for the tapering effect. For more info <a href="https://easings.net/#" target="_blank">click here</a>`))
    .addDropdown(dropdown =>
      dropdown
        .addOptions(EASINGFUNCTIONS)
        .setValue(ps.penOptions.options.easing)
        .onChange(value => {
          this.dirty = true;
          ps.penOptions.options.easing = value;
        })
      )

    new Setting(ce)
      .setName("Simulate Pressure")
      .setDesc("Whether to simulate pressure based on velocity.")
      .addDropdown(dropdown =>
        dropdown
          .addOption("true","Always")
          .addOption("false","Never")
          .addOption("","Yes for mouse, No for pen")
          .setValue(
            ps.penOptions.options.simulatePressure === true
            ? "true" 
            : (ps.penOptions.options.simulatePressure === false
              ? "false"
              : "")
          )
          .onChange(value=>{
            this.dirty = true;
            switch(value) {
              case "true": ps.penOptions.options.simulatePressure = true; break;
              case "false": ps.penOptions.options.simulatePressure = false; break;
              default: delete ps.penOptions.options.simulatePressure;
            }
          })
        )

    ce.createEl("h3",{text: "Start"});
    ce.createEl("p",{text: "Tapering options for the start of the line."})

    new Setting(ce)
      .setName("Cap Start")
      .setDesc("Whether to draw a cap")
      .addToggle(toggle=>
        toggle
          .setValue(ps.penOptions.options.start.cap)
          .onChange(value=> {
            this.dirty = true;
            ps.penOptions.options.start.cap = value;
          })
      )

    let stSetting: Setting;
    stSetting = new Setting(ce)
      .setName(fragWithHTML(`Taper: <b>${ps.penOptions.options.start.taper === true ? "true" : ps.penOptions.options.start.taper}</b>`))
      .setDesc("The distance to taper. If set to true, the taper will be the total length of the stroke.")
      .addSlider(slider=>
        slider
          .setLimits(0,151,1)
          .setValue(typeof ps.penOptions.options.start.taper === "boolean" ? 151 : ps.penOptions.options.start.taper)
          .onChange(value => {
            this.dirty;
            ps.penOptions.options.start.taper = value === 151 ? true : value;
            stSetting.setName(fragWithHTML(`Taper: <b>${ps.penOptions.options.start.taper === true ? "true" : ps.penOptions.options.start.taper}</b>`));
          })
        )

    new Setting(ce)
      .setName("Easing function")
      .setDesc(fragWithHTML(`An easing function for the tapering effect. For more info <a href="https://easings.net/#" target="_blank">click here</a>`))
      .addDropdown(dropdown =>
        dropdown
          .addOptions(EASINGFUNCTIONS)
          .setValue(ps.penOptions.options.start.easing)
          .onChange(value => {
            this.dirty = true;
            ps.penOptions.options.start.easing = value;
          })
        )


    ce.createEl("h3",{text: "End"});
    ce.createEl("p",{text: "Tapering options for the end of the line."})

    new Setting(ce)
      .setName("Cap End")
      .setDesc("Whether to draw a cap")
      .addToggle(toggle=>
        toggle
          .setValue(ps.penOptions.options.end.cap)
          .onChange(value=> {
            this.dirty = true;
            ps.penOptions.options.end.cap = value;
          })
      )

    let etSetting: Setting;
    etSetting = new Setting(ce)
      .setName(fragWithHTML(`Taper: <b>${ps.penOptions.options.end.taper === true ? "true" : ps.penOptions.options.end.taper}</b>`))
      .setDesc("The distance to taper. If set to true, the taper will be the total length of the stroke.")
      .addSlider(slider=>
        slider
          .setLimits(0,151,1)
          .setValue(typeof ps.penOptions.options.end.taper === "boolean" ? 151 : ps.penOptions.options.end.taper)
          .onChange(value => {
            this.dirty;
            ps.penOptions.options.end.taper = value === 151 ? true : value;
            etSetting.setName(fragWithHTML(`Taper: <b>${ps.penOptions.options.end.taper === true ? "true" : ps.penOptions.options.end.taper}</b>`));
          })
        )

    new Setting(ce)
      .setName("Easing function")
      .setDesc(fragWithHTML(`An easing function for the tapering effect. For more info <a href="https://easings.net/#" target="_blank">click here</a>`))
      .addDropdown(dropdown =>
        dropdown
          .addOptions(EASINGFUNCTIONS)
          .setValue(ps.penOptions.options.end.easing)
          .onChange(value => {
            this.dirty = true;
            ps.penOptions.options.end.easing = value;
          })
        )
    
  }
}
