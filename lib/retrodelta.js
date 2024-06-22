const path = require('path');
const util = require('./util');
const logger = util.logger;

const inputDict = { // delta => retroarch
  'quickSave': 'save_state',
  'quickLoad': 'load_state',
  'fastForward': 'hold_fast_forward',
  'toggleFastForward': 'toggle_fast_forward',
  'menu': 'menu_toggle',
};
const inputSame = 'a,b,x,y,l,r,select,start,up,down,left,right';
inputSame.split(',').forEach(input => inputDict[input] = input);
// logger.debug(inputDict);

const defaultConfig = {
  normalized: true,
  range_mod: 1.5,
  alpha_mod: 0.7,
  rotate: { x: 0.95, y: 0.05, w: 0.02, h: 0.02 },
}

class RetroDelta {
  constructor(deltaInfo, config) {
    this.deltaInfo = deltaInfo;
    this.config = { ...defaultConfig, ...config };

    this.parseDelta(deltaInfo);
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
      if (layout.screens?.length !== 1) {
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
      overlay.overlay = this.#getBorderAsset(layout);
      this.overlays.push(overlay);
      for (const item of layout.items) {
        overlay.descs.push(...this.#parseDeltaItem(item, layout));
      }
    }
    // add rotate button
    if (this.overlays.length == 2) {
      for (let overlay of this.overlays) {
        overlay.descs.push({
          _: this.#makeDesc('overlay_next', this.config.rotate),
          // overlay: 'png/rotate.png',
          next_target: possibleOrientations[1 - possibleOrientations.indexOf(overlay.name)],
        });
      }
    }
    // logger.debug(JSON.stringify(overlays));
    // addFilterSwitch(overlays, [
    //   { x: 0.04, y: 0.10 },
    //   { x: 0.25, y: 0.03 },
    // ]);
  }

  #getBorderAsset(layout) {
    // TODO: copy asset, handle PDF
    return layout.assets.large;
  }

  addDebugOverlay() {
    let { debugOverlay } = this.config;
    if (!debugOverlay) {
      debugOverlay = 'debug.png';
      this.#copyFile(debugOverlay, { overwrite: false });
    }
    for (const overlay of this.overlays) {
      for (const desc of overlay.descs) {
        desc.overlay = desc.overlay || debugOverlay;
      }
    }
  }

  #copyFile(fileName, { src, dst, overwrite = true } = {}) {
    src = src || this.config.templatePath;
    dst = dst || this.config.outputPath;
    return util.copyFile(path.join(src, fileName), path.join(dst, fileName), overwrite);
  }

  generateRetroShader() {
    const presetName = 'delta.slangp';
    const shaderName = 'delta.slang';
    this.#copyFile(presetName);
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
      const { name: overlay } = thumbstick;
      this.#copyFile(overlay, { src: this.config.deltaPath, overwrite: false });
      const desc = {
        _: this.#makeStickDesc(thumbstick, frame, extendedEdges, size),
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
      // TODO: add D-pad combo
      const grid = [
        'up|left', 'up', 'up|right',
        'left', '', 'right',
        'down|left', 'down', 'down|right',
      ];
      const dPadGrid = {
        up: [1, 0],
        left: [0, 1],
        right: [2, 1],
        down: [1, 2],
      };
      for (let d in inputs) {
        if (!dPadGrid[d]) {
          logger.warn('Skip unknown direction', d);
          continue;
        }
        const g = dPadGrid[d];
        descs.push(this.#convertInputToDesc([inputs[d]], {
          x: xs[g[0]],
          y: ys[g[1]],
          width: xs[g[0] + 1] - xs[g[0]],
          height: ys[g[1] + 1] - ys[g[1]],
        }, {}, size));
      }
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

  #makeStickDesc(thumbstick, frame, extendedEdges, size, command = 'analog_left', shape = 'radial') {
    const box = this.#convertBox(frame, extendedEdges);
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
}

module.exports = RetroDelta;

// TODO: switch skin
function addFilterSwitch(overlays, boxs) {
  let n = overlays.length;
  for (let i = 0; i < n; ++i) {
    const { x, y } = boxs[i];
    const overlay = deepCopy(overlays[i]);
    const { name } = overlay;
    const nameA = name + '-a';
    overlay.overlay = overlay.overlay.replace('[F]', '[NF]');
    overlay.name = nameA;
    const _ = `overlay_next,${x},${y},rect,0.05,0.05`;
    overlay.descs.push({ _, next_target: name });
    overlays[i].descs.push({ _, next_target: nameA });
    overlays.push(overlay);
  }
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}