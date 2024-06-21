const fs = require('fs');
const path = require('path');

const RetroDelta = require('./lib/retrodelta');
const util = require('./lib/util');
const logger = util.logger;

// logger.info(process.argv);

const argv = process.argv;
const basePath = argv[2];

const config = {
  deltaPath: basePath,
  outputPath: basePath,
  scriptPath: __dirname,
  templatePath: path.join(__dirname, 'template'),
  outputName: 'delta',
  debugName: 'delta-debug',
};
logger.debug(config);

const deltaInfo = util.readJson(path.join(config.deltaPath, 'info.json'));
const retro = new RetroDelta(deltaInfo, config);
retro.generateRetroShader();
util.saveFile(retro.generateRetroConfig(), path.join(config.outputPath, `${config.outputName}.cfg`));
if (config.debugName) {
  retro.addDebugOverlay();
  util.saveFile(retro.generateRetroConfig(), path.join(config.outputPath, `${config.debugName}.cfg`));
}