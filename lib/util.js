const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

const logger = console;

function readJson(filePath, mayNotFound = false) {
  let data;
  logger.info('Reading', filePath);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    data = JSON5.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT' || !mayNotFound) {
      logger.error('Error reading JSON file:', err);
    }
  }
  return data;
}

function readFile(filePath) {
  let data;
  logger.info('Reading', filePath);
  try {
    data = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    logger.error('Error reading file:', err);
  }
  return data;
}

function saveFile(text, filePath) {
  logger.info('Saving', filePath);
  try {
    fs.writeFileSync(filePath, text, 'utf-8');
  } catch (err) {
    logger.error('Error saving file:', err);
  }
}

function copyFile(sourcePath, destinationPath, overwrite = true) {
  try {
    if (!overwrite && fs.existsSync(destinationPath)) {
      return logger.info('Skip copying existing file', destinationPath);
    }
    logger.log(`Copying ${sourcePath} => ${destinationPath}`);
    const data = fs.readFileSync(sourcePath);
    fs.writeFileSync(destinationPath, data);
  } catch (err) {
    logger.error('An error occurred while copying the file', err);
  }
}

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    logger.info('Creating directory', directoryPath);
  }
}

const AdmZip = require('adm-zip');

function removeZipExtension(filePath) {
  return filePath.replace(/\.(zip|deltaskin)$/, '');
}

function unzip(filePath, overwrite = false, outputPath) {
  outputPath = outputPath || removeZipExtension(filePath);
  
  if (fs.existsSync(outputPath) && !overwrite) {
    console.log(`Directory already exists: ${outputPath}`);
    return outputPath;
  }

  const zip = new AdmZip(filePath);
  zip.extractAllTo(outputPath, true);
  console.log(`Unzip complete: ${outputPath}`);
  return outputPath;
}

const { execSync } = require('child_process');

function executeCommandSync(command) {
  try {
    const output = execSync(command, { encoding: 'utf8' });
    return output.trim();
  } catch (error) {
    console.error('Error:', error.stderr.toString().trim());
    return null;
  }
}

function getPdfInfo(pdfPath) {
  let pdfInfo = executeCommandSync(`magick identify -format "%w %h %x %y " "${pdfPath}"`);
  pdfInfo = pdfInfo.split(/\s/).map(x => parseInt(x));
  if (pdfInfo.length != 4) throw new Error('Fail to parse PDF info');
  const [ w, h, x, y ] = pdfInfo;
  return { w, h, x, y};
}

function calcDpi(pdfInfo, pngInfo) {
  // logger.debug(pdfInfo, pngInfo);
  const { w, h, x, y } = pdfInfo;
  let dpi = [ x / w * pngInfo.w, y / h * pngInfo.h ].map(Math.ceil);
  if (dpi[0] !== dpi[1]) {
    logger.warn('DPI not match', dpi);
  }
  dpi = Math.max(...dpi);
  return dpi;
}

function convertPdfToPng({ pdfPath, pngPath, w, h, extent, gravity = 'center', oversampling = 2, overwrite = false, quality = 90 }) {
  if (!overwrite && fs.existsSync(pngPath)) {
    return logger.info('Skip converting existing png', pngPath);
  }
  const pdfInfo = getPdfInfo(pdfPath);
  const dpi = calcDpi(pdfInfo, { w, h }) * oversampling;
  const command = [
    'magick',
    `-density ${dpi}`,
    `"${pdfPath}"`,
    `-resize ${w}x${h}`,
  ];
  if (extent) {
    command.push(`-background none -gravity ${gravity} -extent ${extent.w}x${extent.h}`);
  }
  command.push(`-quality ${quality} "${pngPath}"`);
  executeCommandSync(command.join(' '));
  logger.info(`Convert ${pdfPath} => ${pngPath}`);
}

module.exports = {
  readFile,
  readJson,
  saveFile,
  copyFile,
  ensureDirectoryExists,
  removeZipExtension,
  unzip,
  convertPdfToPng,
  logger
};