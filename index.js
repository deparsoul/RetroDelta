const fs = require('fs');
const path = require('path');

const deltaInfoPath = '../deltaskin/info.json';
const outputPath = '../RetroArch-Win64/delta';
const normalized = true;

function convert(deltaInfoPath, outputPath) {
  let deltaInfo;
  try {
    const raw = fs.readFileSync(deltaInfoPath, 'utf-8');
    deltaInfo = JSON.parse(raw);
  } catch (err) {
    console.error('Error reading JSON file:', err);
  }

  // console.log(deltaInfo);

  const representations = deltaInfo?.representations?.iphone?.edgeToEdge;
  if (!representations) {
    return console.error('Currently only support iphone edgeToEdge');
  }
  const overlays = [];
  const orientations = [ 'portrait', 'landscape' ];
  for (const orientation in representations) {
    if (!orientations.includes(orientation)) {
      console.warn('Skip unknown orientation', orientation);
      continue;
    }
    console.log('Processing', orientation);
    const layout = representations[orientation];
    console.log(layout);
    const overlay = {
      name: orientation,
      full_screen: false,
      normalized,
      range_mod: 1.5,
      alpha_mod: 0.7,
      descs: [],
    };
    overlay.overlay = layout.assets.large;
    overlays.push(overlay);
    for (const item of layout.items) {
      overlay.descs.push(...convertItem(item, layout));
      // break;
    }
    // add rotate button
    overlay.descs.push({
      _: 'overlay_next,0.95,0.05,rect,0.05,0.05',
      // overlay: 'png/rotate.png',
      next_target: orientations[1 - orientations.indexOf(orientation)],
    });
    // break;
  }
  console.log(JSON.stringify(overlays));
  addFilterSwitch(overlays, [
    { x: 0.04, y: 0.10 },
    { x: 0.25, y: 0.03 },
  ]);
  generateRetroConfig(overlays, path.join(outputPath, 'delta.cfg'));
  generateRetroConfig(enableDebug(overlays), path.join(outputPath, 'delta-debug.cfg'));
}

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

function convertItem(item, layout) {
  const { inputs, frame } = item;
  const extendedEdges = { ...layout.extendedEdges, ...item.extendedEdges };
  const size = layout.mappingSize;
  const descs = [];
  console.log(inputs, frame, extendedEdges);
  if (Array.isArray(inputs)) {
    descs.push(convertInputs(inputs, frame, extendedEdges, size));
  } else {
    // handle D-pad
    const xs = [0, 1, 2, 3].map(i => frame.x + frame.width  / 3 * i);
    const ys = [0, 1, 2, 3].map(i => frame.y + frame.height / 3 * i);
    const { top = 0, bottom = 0, left = 0, right = 0 } = extendedEdges;
    xs[0] -= left; xs[3] += right;
    ys[0] -= top;  ys[3] += bottom;
    const dPadGrid = {
      up: [1, 0],
      left: [0, 1],
      right: [2, 1],
      down: [1, 2],
    };
    for (let d in inputs) {
      if (!dPadGrid[d]) {
        console.warn('Skip unknown direction', d);
        continue;
      }
      const g = dPadGrid[d];
      descs.push(convertInputs([inputs[d]], { 
        x: xs[g[0]],
        y: ys[g[1]],
        width: xs[g[0] + 1] - xs[g[0]],
        height: ys[g[1] + 1] - ys[g[1]],
      }, {}, size));
    }
  }
  return descs;
}

function convertInputs(inputs, frame, extendedEdges, size) {
  const inputDict = { // delta => retroarch
    'quickSave': 'save_state',
    'quickLoad': 'load_state',
    'fastForward': 'hold_fast_forward',
    'toggleFastForward': 'toggle_fast_forward',
    'menu': 'menu_toggle',
  };
  const inputSame = 'a,b,x,y,l,r,select,start,up,down,left,right';
  inputSame.split(',').forEach(input => inputDict[input] = input);
  // console.log(inputDict);
  const command = inputs.map(input => {
    if (!inputDict[input]) {
      console.warn('Unknown input', input);
    }
    return inputDict[input];
  }).filter(x => x).join('|');
  const box = convertBox(frame, extendedEdges, size);
  box.shape = 'rect';
  const desc = {
    _: makeDesc(command, box, size)
  };
  return desc;
}

function convertBox({ x, y, width: w, height: h }, { top = 0, bottom = 0, left = 0, right = 0 }) {
  w += left + right; w /= 2;
  h += top + bottom; h /= 2;
  x += w - left;
  y += h - top;
  return { x, y, w, h };
}

function makeDesc(command, { x, y, w, h, shape }, size) {
  if (normalized) {
    x /= size.width;  w /= size.width;
    y /= size.height; h /= size.height;
  }
  let desc = [
    command,
    round(x),
    round(y),
    shape,
    round(w),
    round(h),
  ];
  desc = desc.join(',');
  return desc;
}

function round(x) {
  const digits = normalized ? 6 : 1;
  return x.toFixed(digits);
}

convert(deltaInfoPath, outputPath);

function generateRetroConfig(overlays, outputPath) {
  let lines = [];
  lines.push(...generateRetroBlock('overlay', overlays));
  lines = lines.join('\n');
  // console.log(lines);
  fs.writeFileSync(outputPath, lines, 'utf8');
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function enableDebug(overlays, debugOverlay='debug.png') {
  overlays = deepCopy(overlays);
  for (const overlay of overlays) {
    for (const desc of overlay.descs) {
      desc.overlay = desc.overlay || debugOverlay;
    }
  }
  return overlays;
}

function generateRetroBlock(prefix, block) {
  const lines = [];
  if (Array.isArray(block)) {
    lines.push(`${prefix}s = ${block.length}`);
    for (let i = 0; i < block.length; ++i) {
      lines.push(...generateRetroBlock(prefix + i, block[i]));
    }
  } else if (typeof block === 'object') {
    for (const key in block) {
      let tail = '_' + key;
      if (key === 'descs') tail = '_desc';
      if (key === '_') tail = '';
      lines.push(...generateRetroBlock(prefix + tail, block[key]));
    }
  } else if (typeof block === 'string') {
    lines.push(`${prefix} = "${block}"`);
  } else {
    lines.push(`${prefix} = ${block}`);
  }
  return lines;
}
