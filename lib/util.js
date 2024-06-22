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
    console.log(`Copying ${sourcePath} => ${destinationPath}`);
    const data = fs.readFileSync(sourcePath);
    fs.writeFileSync(destinationPath, data);
  } catch (err) {
    console.error('An error occurred while copying the file', err);
  }
}

module.exports = {
  readFile,
  readJson,
  saveFile,
  copyFile,
  logger
};