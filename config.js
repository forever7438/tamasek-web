// config.js
const path = require('path');

module.exports = {
  REMOTE_SOURCE: process.env.REMOTE_SOURCE || 'https://www.temasek.com.sg',
  MAX_REDIRECT: parseInt(process.env.MAX_REDIRECT, 10) || 3,
  DOWNLOAD_TIMEOUT: parseInt(process.env.DOWNLOAD_TIMEOUT, 10) || 10000,
  STATIC_DIR: process.env.STATIC_DIR || process.cwd(),
  CACHE_DIR: process.env.CACHE_DIR || path.join(__dirname, '.cache'),
  LOG_FILE: process.env.LOG_FILE || path.join(__dirname, 'access.log'),
};