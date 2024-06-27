# RetroDelta

RetroDelta is an open-source tool designed to convert Delta skins to RetroArch.
RetroDelta is in the early stages of development at this moment and is recommended for use only by experienced users and skin creators.

## Getting Started

### Prerequisites

If you want to convert skins, you will typically need to install and configure the following environment in advance:
- [Node.js](https://nodejs.org/)
- (Optional, if you need to convert skins containing PDFs) [ImageMagick](https://imagemagick.org/) and [Ghostscript](https://www.ghostscript.com/)

### Convert Skins

1. Download and extract this project.
2. Open the terminal and navigate to the project directory.
3. Run `npm i` to install Node.js dependencies.
3. Run `npm start <path to deltaskin>`. For more usage information, refer to the `example` directory.

### Use Converted Skins in RetroArch

Since RetroArch currently does not have one-click skin system like Delta, configuring the skin may be slightly complicated. However, don't worry, once you are familiar with the following steps, using the skin will be almost as convenient as Delta. Especially when you have saved the core settings, changing to another skin only requires loading the new overlay and shader.

1. Transfer the generated directory to a location accessible by your emulator. This directory should include files like `delta.cfg` and `delta.slangp`.
2. Open RetroArch.
3. Basic configuration:
   1. Set video scaling to full: `Settings -> Video -> Scaling -> Aspect Ratio -> Full`
   2. Allow notch overlay: `Settings -> Video -> Enable fullscreen over notch ...`
4. Open the game for which you want to configure the skin, and open RetroDelta `Quick Menu`
5. Set up overlay with `delta.cfg`, including skin backgrounds, buttons, etc.
   1. Open `Quick Menu -> On-Screen Overlay`
   2. Enable `Display Overlay`
   3. Choose your `delta.cfg` in `Overlay Preset`
   4. Set `Overlay Opacity` to `1.00`
   5. Enable `Auto-Rotate Overlay`
   6. Disable `Auto-Scale Overlay`
   7. Save the configuration as you prefer, for example `Quick Menu -> Overrides -> Save Core Overrides`
6. Set up shaders with `delta.slangp`, for mapping screen positions.
   1. Open `Quick Menu -> Shaders`
   2. Enable `Video Shaders`
   3. Choose your `delta.slangp` in `Load Preset`
   4. Save the configuration as you prefer, for example `Save Preset -> Save Core Preset`
7. Done. Enjoy your play!

## Features / Compatibility

Delta skins support a wide range of features (https://noah978.gitbook.io/delta-docs/skins). Currently supported features include:

- Support for models other than DS.
- Skins must include an iPhone edgeToEdge layout.
- Supports automatic rotation if the skin contains both portrait and landscape layouts.
- Skins can only contain a single screen area. For example, DS skins usually use multiple screen areas, and skins that use special screen lighting effects or button backlight may also contain multiple screen areas.
- Support for skins with PDF assets, which will be automatically converted into images of suitable resolution.
- Supports debug mode, you can load `delta-debug.cfg` to display red overlays similar to Delta.
- Supports the `translucent` parameter in Delta, which controls whether the skin overlays the screen or is placed below it.
- Partial support for joystick; does not support mapping joysticks to custom buttons through the skin. However, you can map the joystick to the D-Pad in RetroArch settings.

## Additional Features

Since RetroArch supports toggling overlays through button, you can merge multiple Delta skins together and switch between them in real-time using an additional button. For example, you can switch between filtered / non-filtered skins or skins with D-Pad / joystick.
Refer to the advanced examples for more information.

## Frequently Asked Questions

**Q: Are there plans to support DS skins?**

A: Yes. However, it may only be possible to support limited skin layouts, primarily due to the inability to remap touch areas.

**Q: What should I do if I encounter skins that cannot be converted properly?**

A: Make sure you have followed the steps correctly as outlined above. For example, you can try loading skins from the example folder to confirm that your actions are correct. If you still encounter problems, please submit an issue. It should include the download link of the skin, the specific problem you encountered, and relevant error messages and screenshots if available.

**Q: Can it be used together with other shaders?**

A: Yes. As long as the shader does not alter the screen position and size.

**Q: I encountered problems while setting up skins for N64. Is there anything specific I should be aware of?**

A: You may need to set the RDP Plugin to Angrylion; otherwise, shaders may not work with N64 games. Additionally, since the N64 controller has more buttons, this project maps C Buttons to the right joystick. RetroArch will, by default, map the right joystick to the C Buttons. If you encounter issues, please check your control settings.



## Acknowledgements
We would like to express our gratitude to the following individuals and organizations for their contributions and support:

- [R3BEL](https://www.reddit.com/user/R3BEL85/)
- [Delta](https://github.com/rileytestut/Delta)
- [RetroArch](https://github.com/libretro/RetroArch)

We also thank all our users and the open-source community for their continuous support and contributions.