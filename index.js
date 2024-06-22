const fs = require('fs');
const path = require('path');

const RetroDelta = require('./lib/retrodelta');
const util = require('./lib/util');
const logger = util.logger;

const argv = process.argv;
if (argv.length != 3) {
  logger.info('\nUsage: node index "<Delta Skin Path>"\n');
  process.exit(1);
}

const basePath = argv[2];
const configPath = path.join(basePath, 'retrodelta.json');

const defaultConfig = {
  deltaPath: '.',
  outputPath: '.',
  templatePath: path.join(__dirname, 'template'),
  outputName: 'delta',
  debugName: 'delta-debug',
};
const config = { ...defaultConfig, ...util.readJson(configPath, true) };
for (const key in config) {
  if (key.endsWith('Path')) {
    config[key] = path.resolve(basePath, config[key]);
  }
}
logger.debug(config);

const retro = new RetroDelta(config);

if (config.switchSkin) {
  const retros = config.switchSkin.map(deltaPath => new RetroDelta({ ...config, deltaPath: path.resolve(basePath, deltaPath) }));
  retro.addSwitchSkin(retros);
}

retro.generateRetroShader();
util.saveFile(retro.generateRetroConfig(), path.join(config.outputPath, `${config.outputName}.cfg`));

if (config.debugName) {
  retro.addDebugOverlay();
  util.saveFile(retro.generateRetroConfig(), path.join(config.outputPath, `${config.debugName}.cfg`));
}