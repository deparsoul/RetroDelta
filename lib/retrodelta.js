const path = require('path');
const util = require('./util');
const logger = util.logger;

const inputDict = { // delta => retroarch
  'quickSave': 'save_state',
  'quickLoad': 'load_state',
  'fastForward': 'hold_fast_forward',
  'toggleFastForward': 'toggle_fast_forward',
  'menu': 'menu_toggle',
  // n64
  'z': 'l2',
  'cUp': 'r_y_minus',
  'cDown': 'r_y_plus',
  'cLeft': 'r_x_minus',
  'cRight': 'r_x_plus',
  'analogStickUp': 'l_y_minus',
  'analogStickDown': 'l_y_plus',
  'analogStickLeft': 'l_x_minus',
  'analogStickRight': 'l_x_plus',
};
const inputSame = 'a,b,x,y,l,r,select,start,up,down,left,right';
inputSame.split(',').forEach(input => inputDict[input] = input);
// logger.debug(inputDict);

const defaultConfig = {
  normalized: true,
  range_mod: 1.5,
  alpha_mod: 0.7,
  rotateButton: { x: 0.95, y: 0.05, w: 0.00, h: 0.00 },
  switchButton: { x: 0.95, y: 0.95, w: 0.01, h: 0.01 },
  consoleAspectRatio: null,
  targetScreenSize: { w: 1290, h: 2796 }, // iPhone 15 Pro Max
}

// https://noah978.gitbook.io/delta-docs/skins#game-screens
const consoleAspectRatios = {
  gbc: 10 / 9,
  gba: 3 / 2,
  ds:  2 / 3,
  nes: 16 / 15,
  snes: 8 / 7,
  n64:  8 / 7,
};

class RetroDelta {
  constructor(config) {
    this.config = { ...defaultConfig, ...config };
    if (this.config.deltaPath.endsWith('.deltaskin')) {
      this.config.deltaPath = util.unzip(this.config.deltaPath, true);
    }
    // logger.debug(this.config);
    this.deltaInfo = util.readJson(path.join(this.config.deltaPath, 'info.json'));
    this.parseDelta(this.deltaInfo);
  }

  parseDelta(deltaInfo) {
    if (!deltaInfo) throw new Error('Invalid info file');
    if (deltaInfo?.gameTypeIdentifier === 'com.rileytestut.delta.game.ds') throw new Error('Currently does not support NDS');
    const representations = deltaInfo?.representations?.iphone?.edgeToEdge;
    if (!representations) throw new Error('Currently only support iphone edgeToEdge');
    this.overlays = [];
    this.screens = {};
    const possibleOrientations = [ 'portrait', 'landscape' ];
    for (const orientation in representations) {
      if (!possibleOrientations.includes(orientation)) {
        logger.warn('Skip unknown orientation', orientation);
        continue;
      }
      logger.info('Processing', orientation);
      const layout = representations[orientation];
      this.#fitToScreen(layout, orientation);
      if (layout.screens?.length > 1) {
        throw new Error('Currently only support single screen');
      }
      this.screens[orientation] = { mappingSize: layout.mappingSize, ...layout.screens[0] };
      // logger.debug(layout);
      const { normalized, range_mod, alpha_mod } = this.config;
      const overlay = {
        name: orientation,
        full_screen: false,
        normalized, range_mod, alpha_mod,
        descs: [],
      };
      this.#addBorder(overlay, layout);
      this.overlays.push(overlay);
      for (const item of layout.items) {
        overlay.descs.push(...this.#parseDeltaItem(item, layout));
      }
    }
    // add rotate button
    if (this.overlays.length == 2) {
      for (let overlay of this.overlays) {
        overlay.descs.push({
          _: this.#makeDesc('overlay_next', this.#getButtonConfig('rotate', overlay)),
          next_target: possibleOrientations[1 - possibleOrientations.indexOf(overlay.name)],
        });
      }
    }
    // logger.debug(JSON.stringify(overlays));
  }

  #addBorder(overlay, layout) {
    const asset = this.#getBorderAsset(layout);
    overlay.descs.unshift({
      _: this.#makeDesc('null', this.#convertBox(layout.borderFrame, {}), layout.mappingSize),
      alpha_mod: 1,
      overlay: asset
    });
  }

  #applyFit(obj, scale, offset) {
    if (!obj) return;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        switch (key) {
          case 'width': case 'height':
          case 'top': case 'bottom':
          case 'left': case 'right':
            obj[key] *= scale;
            break;
          case 'x': case 'y':
            obj[key] = obj[key] * scale + offset[key];
        }
      }
    }
  }

  #fitToScreen(layout, orientation) {
    const isPortrait = orientation === 'portrait';
    const { translucent } = layout; 
    let target = { ...this.config.targetScreenSize };
    if (!isPortrait) {
      target = { ...target, w: target.h, h: target.w };
    }
    const { width: w, height: h } = layout.mappingSize;
    const oldSize = { w, h };
    const scale = Math.min(target.w / oldSize.w, target.h / oldSize.h);
    const newSize = { w: oldSize.w * scale, h: oldSize.h * scale };
    const offset = {
      x: (target.w - newSize.w) / 2,
      y: (target.h - newSize.h) / (translucent ? 2 : 1),
    };
    layout.borderFrame = { ...offset, width: newSize.w, height: newSize.h };
    layout.newSize = newSize;
    layout.mappingSize.height = target.h;
    layout.mappingSize.width = target.w;
    // logger.debug({ scale, offset, target, oldSize, newSize });
    this.#applyFit(layout.extendedEdges, scale, offset);
    for (const item of layout.items) {
      this.#applyFit(item.thumbstick, scale, offset);
      this.#applyFit(item.frame, scale, offset);
      this.#applyFit(item.extendedEdges, scale, offset);
    }
    let { screens, gameScreenFrame } = layout;
    screens = screens || []
    if (!screens.length && gameScreenFrame) {
      screens.push({ outputFrame: gameScreenFrame });
    }
    for (const screen of screens) {
      this.#applyFit(screen.outputFrame, scale, offset);
    }
    if (!screens.length) {
      screens.push(this.#addScreen(translucent, target, newSize));
    }
    // logger.debug(screens);
    layout.screens = screens;
  }

  #getConsoleAspectRatio() {
    const key = this.deltaInfo.gameTypeIdentifier.split('.').pop();
    return this.config.consoleAspectRatio || consoleAspectRatios[key];
  }

  #addScreen(translucent, target, newSize) {
    const screenSize = {
      w: target.w,
      h: target.h,
    };
    if (!translucent) {
      screenSize.h -= newSize.h;
    }
    const h = screenSize.h;
    const aspect = this.#getConsoleAspectRatio();
    if (screenSize.w / screenSize.h > aspect) {
      screenSize.w = screenSize.h * aspect;
    } else {
      screenSize.h = screenSize.w / aspect;
    }
    const outputFrame = {
      width: screenSize.w,
      height: screenSize.h,
      x: (target.w - screenSize.w) / 2,
      y: (h - screenSize.h) / 2,
    };
    return { outputFrame };
  }

  #getPdfAsPngAsset(pdf, { w, h }, { src, dst, extent, gravity }) {
    dst = dst || this.config.outputPath;
    const pdfPath = path.join(src, pdf);
    const png = pdf.replace(/pdf$/, 'png');
    const pngPath = path.join(src, png);
    util.convertPdfToPng({ pdfPath, pngPath, w, h, extent, gravity });
    return png;
  }

  #getBorderAsset(layout) {
    const src = this.config.deltaPath;
    const { large, resizable } = layout.assets;
    let asset = large || resizable;
    if (asset.endsWith('.pdf')) {
      const { newSize } = layout;
      return this.#getPdfAsPngAsset(asset, newSize, { src });
    }
    this.#copyFile(asset, { src });
    return asset;
  }

  addDebugOverlay() {
    let { debugOverlay } = this.config;
    if (!debugOverlay) {
      debugOverlay = 'debug.png';
      this.#copyFile(debugOverlay);
    }
    for (const overlay of this.overlays) {
      for (const desc of overlay.descs) {
        desc.overlay = desc.overlay || debugOverlay;
      }
    }
  }

  #copyFile(fileName, { src, dst, overwrite = false } = {}) {
    src = src || this.config.templatePath;
    dst = dst || this.config.outputPath;
    return util.copyFile(path.join(src, fileName), path.join(dst, fileName), overwrite);
  }

  generateRetroShader() {
    const presetName = 'delta.slangp';
    const shaderName = 'delta.slang';
    this.#copyFile(presetName, { overwrite: true });
    let shader = util.readFile(path.join(this.config.templatePath, shaderName));
    const shaderConfig = {};
    for (let orientation in this.screens) {
      const screen = this.screens[orientation];
      // logger.debug(orientation, screen);
      const { width, height } = screen.mappingSize;
      const { x, y, width: w, height: h } = screen.outputFrame;
      shaderConfig[`${orientation[0]}_border_size`] = `vec2(${width}, ${height})`;
      shaderConfig[`${orientation[0]}_screen_size`] = `vec2(${w}, ${h})`;
      shaderConfig[`${orientation[0]}_screen_offset`] = `vec2(${x}, ${y})`;
    }
    const regex = /\b(([pl]_\w+)\s*=\s*)[^;]+/g;
    shader = shader.replace(regex, (raw, prefix, key) => {
      return shaderConfig[key] ? `${prefix}${shaderConfig[key]}` : raw;
    });
    util.saveFile(shader, path.join(this.config.outputPath, shaderName));
  }

  generateRetroConfig() {
    let lines = [];
    lines.push(...this.#generateRetroBlock('overlay', this.overlays));
    lines = lines.join('\n');
    return lines;
  }

  #generateRetroBlock(prefix, block) {
    const lines = [];
    if (Array.isArray(block)) {
      lines.push(`${prefix}s = ${block.length}`);
      for (let i = 0; i < block.length; ++i) {
        lines.push(...this.#generateRetroBlock(prefix + i, block[i]));
      }
    } else if (typeof block === 'object') {
      for (const key in block) {
        let tail = '_' + key;
        if (key === 'descs') tail = '_desc';
        if (key === '_') tail = '';
        lines.push(...this.#generateRetroBlock(prefix + tail, block[key]));
      }
    } else if (typeof block === 'string') {
      lines.push(`${prefix} = "${block}"`);
    } else {
      lines.push(`${prefix} = ${block}`);
    }
    return lines;
  }

  #parseDeltaItem(item, layout) {
    const { inputs, frame, thumbstick } = item;
    const extendedEdges = { ...layout.extendedEdges, ...item.extendedEdges };
    const size = layout.mappingSize;
    const descs = [];
    // logger.debug(inputs, frame, extendedEdges);
    if (Array.isArray(inputs)) {
      descs.push(this.#convertInputToDesc(inputs, frame, extendedEdges, size));
    } else if (thumbstick) {
      const src = this.config.deltaPath;
      let { name: overlay, width: w, height: h } = thumbstick;
      if (overlay.endsWith('.pdf')) {
        overlay = this.#getPdfAsPngAsset(overlay, { w, h }, { src });
      } else {
        this.#copyFile(overlay, { src });
      }
      const right = inputs['up'] === 'cUp'; // map n64 c-stick to right stick
      const desc = {
        _: this.#makeStickDesc(thumbstick, frame, extendedEdges, size, right),
        overlay,
        movable: true,
      };
      descs.push(desc);
    } else {
      // handle D-pad
      const xs = [0, 1, 2, 3].map(i => frame.x + frame.width / 3 * i);
      const ys = [0, 1, 2, 3].map(i => frame.y + frame.height / 3 * i);
      const { top = 0, bottom = 0, left = 0, right = 0 } = extendedEdges;
      xs[0] -= left; xs[3] += right;
      ys[0] -= top; ys[3] += bottom;
      const grid = [
        ['up|left', 'up', 'up|right'],
        ['left', '', 'right'],
        ['down|left', 'down', 'down|right']
      ];
      grid.forEach((row, j) => row.forEach((buttons, i) => {
        if (!buttons) return;
        buttons = buttons.split('|').map(button => inputs[button]);
        // logger.debug(j, i, buttons);
        descs.push(this.#convertInputToDesc(buttons, {
          x: xs[i],
          y: ys[j],
          width: xs[i + 1] - xs[i],
          height: ys[j + 1] - ys[j],
        }, {}, size));
      }));
    }
    return descs;
  }

  #convertInputToDesc(inputs, frame, extendedEdges, size) {
    const command = inputs.map(input => {
      if (!inputDict[input]) {
        logger.warn('Unknown input', input);
      }
      return inputDict[input];
    }).filter(x => x).join('|');
    const box = this.#convertBox(frame, extendedEdges);
    box.shape = 'rect';
    const desc = {
      _: this.#makeDesc(command, box, size)
    };
    return desc;
  }

  #convertBox({ x, y, width: w, height: h }, { top = 0, bottom = 0, left = 0, right = 0 }) {
    w += left + right; w /= 2;
    h += top + bottom; h /= 2;
    x += w - left;
    y += h - top;
    return { x, y, w, h };
  }

  #makeStickDesc(thumbstick, frame, extendedEdges, size, right, shape = 'radial') {
    const command = right ? 'analog_right' : 'analog_left';
    const box = this.#convertBox(frame, {}); // It seems that the stick is always at the centor of the frame without extendedEdges
    box.shape = shape;
    box.w = thumbstick.width / 2;
    box.h = thumbstick.height / 2;
    return this.#makeDesc(command, box, size);
  }

  #makeDesc(command, { x, y, w, h, shape = 'rect' }, size) {
    if (this.config.normalized && size) {
      x /= size.width; w /= size.width;
      y /= size.height; h /= size.height;
    }
    let desc = [
      command,
      this.#round(x),
      this.#round(y),
      shape,
      this.#round(w),
      this.#round(h),
    ];
    desc = desc.join(',');
    return desc;
  }

  #round(x) {
    const digits = this.config.normalized ? 6 : 1;
    return x.toFixed(digits);
  }

  addSwitchSkin(retros) {
    let overlayNum = this.overlays.length;
    for (const retro of retros) {
      if (retro.overlays.length !== overlayNum) throw new Error('Switch skin length not match');
      this.overlays.push(...retro.overlays);
    }
    let skinNum = retros.length + 1;
    for (let i = 0; i < this.overlays.length; ++i) {
      const overlay = this.overlays[i];
      const skinIndex = Math.floor(i / overlayNum);
      const skinIndexNext = (skinIndex + 1) % skinNum;
      const nameNext = overlay.name + `_switch${skinIndexNext}`;
      const namePostfix = `_switch${skinIndex}`;
      overlay.name += namePostfix;
      for (const desc of overlay.descs) {
        if (desc.next_target) {
          desc.next_target += namePostfix;
        }
      }
      overlay.descs.push({
        _: this.#makeDesc('overlay_next', this.#getButtonConfig('switch', overlay)),
        next_target: nameNext,
      });
    }
  }

  #getButtonConfig(key, overlay) {
    let button = this.config[`${key}Button`];
    const orientation = overlay.name.split('_')[0];
    button = button[orientation] || button;
    return button;
  }
}

module.exports = RetroDelta;