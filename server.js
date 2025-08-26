// server.js
const http = require("http");
const https = require("https");
const fs = require("fs").promises;
const { createWriteStream } = require("fs"); // Explicitly import createWriteStream
const path = require("path");
const url = require("url");
const winston = require("winston");
const mime = require("mime-types");
const zlib = require("zlib");
const util = require("util");
const rateLimit = require("express-rate-limit");
const stream = require("stream");

const httpsOptions = {
  key: require("fs").readFileSync(path.resolve(__dirname, "privkey1.pem")),
  cert: require("fs").readFileSync(path.resolve(__dirname, "fullchain1.pem")),
  //   key: require("fs").readFileSync(path.resolve("/etc/letsencrypt/live/localhost:8087/privkey.pem")),
  // cert: require("fs").readFileSync(path.resolve("/etc/letsencrypt/live/localhost:8087/fullchain.pem")),
  ciphers: "ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256",
  honorCipherOrder: true,
  minVersion: "TLSv1.2",
};

// Load configuration
const config = require("./config");

fs.mkdir(config.CACHE_DIR, { recursive: true }).catch(console.error);

// Logger setup with Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(
      ({ timestamp, level, message }) =>
        `${timestamp} ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new winston.transports.File({
      filename: config.LOG_FILE,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.Console(),
  ],
});

function isSafePath(userPath) {
  // 规范化路径并解析
  const normalizedPath = path
    .normalize(userPath)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = path.join(config.STATIC_DIR, normalizedPath);

  // 解析真实路径并检查是否在安全目录内
  const resolvedPath = path.resolve(config.STATIC_DIR, normalizedPath);
  const staticDir = path.resolve(config.STATIC_DIR);

  // 双重检查路径安全性
  return (
    resolvedPath.startsWith(staticDir) &&
    fullPath.indexOf("\0") === -1 &&
    !/\.\./g.test(path.relative(staticDir, resolvedPath))
  );
}

// Serve static file with ETag caching

async function serveFile(filePath, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  let contentType = mime.lookup(filePath) || "text/html";
  const stats = await fs.stat(filePath);
  const etag = `W/"${stats.size}-${stats.mtimeMs}"`;

  if (ext === ".pdf") contentType = "application/pdf"; // Explicitly set for PDF

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304);
    return res.end();
  }

  const cacheControl = ext.match(/\.(html|htm)$/)
    ? "no-cache"
    : "public, max-age=86400";
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    // "Content-Security-Policy":
    //   "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:;",
    "Content-Security-Policy":
      ext === ".pdf"
        ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:"
        : "",
    "Access-Control-Allow-Origin": "*", // 允许所有来源跨域
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
  };

  // 判断是否支持压缩
  const acceptEncoding = req.headers["accept-encoding"] || "";

  const pipeline = util.promisify(stream.pipeline);

  try {
    const readStream = require("fs").createReadStream(filePath);

    if (/\bbr\b/.test(acceptEncoding)) {
      headers["Content-Encoding"] = "br";
      res.writeHead(200, headers);
      await pipeline(readStream, zlib.createBrotliCompress(), res);
    } else if (/\bgzip\b/.test(acceptEncoding)) {
      headers["Content-Encoding"] = "gzip";
      res.writeHead(200, headers);
      await pipeline(readStream, zlib.createGzip(), res);
    } else if (/\bdeflate\b/.test(acceptEncoding)) {
      headers["Content-Encoding"] = "deflate";
      res.writeHead(200, headers);
      await pipeline(readStream, zlib.createDeflate(), res);
    } else {
      res.writeHead(200, headers);
      await pipeline(readStream, res);
    }
  } catch (err) {
    logger.error(`Pipeline error: ${err.message}`);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal Server Error");
  }
}

async function handleMissingFile(originalPath, req, res) {
  const pathsToCheck = [
    originalPath,
    `${originalPath}.html`,
    path.join(originalPath, "index.html"),
  ].filter(Boolean);

  for (const checkPath of pathsToCheck) {
    // 使用大小写不敏感检查
    const realPath = await fileExistsCaseInsensitive(checkPath);
    if (realPath && isSafePath(realPath)) {
      return serveFile(realPath, req, res);
    }
  }

  // 再查 downloaded 目录
  const downloadedRoot = path.resolve("downloaded");
  for (const checkPath of pathsToCheck) {
    const rel = path.relative(config.STATIC_DIR, checkPath);
    const downloadedPath = path.join(downloadedRoot, rel);
    const stats = await fs.stat(downloadedPath).catch(() => null);
    if (stats && stats.isFile()) {
      return serveFile(downloadedPath, req, res);
    }

    // 新增：查找 downloaded/relDir/baseNoExt/baseName
    const baseName = path.basename(rel);
    const relDir = path.dirname(rel);
    const ext = path.extname(baseName);
    const baseNoExt = ext ? baseName.slice(0, -ext.length) : baseName;

    // 1. downloaded/relDir/baseNoExt/baseName
    const nestedPath = path.join(downloadedRoot, relDir, baseNoExt, baseName);
    const nestedStats = await fs.stat(nestedPath).catch(() => null);
    if (nestedStats && nestedStats.isFile()) {
      return serveFile(nestedPath, req, res);
    }

    // 2. downloaded/relDir/baseNoExt/_
    const underScorePath = path.join(downloadedRoot, relDir, baseNoExt, "_");
    const underScoreStats = await fs.stat(underScorePath).catch(() => null);
    if (underScoreStats && underScoreStats.isFile()) {
      return serveFile(underScorePath, req, res);
    }

    // 3. downloaded/relDir/baseNoExt/_.html
    const underScoreHtmlPath = path.join(
      downloadedRoot,
      relDir,
      baseNoExt,
      "_.html"
    );
    const underScoreHtmlStats = await fs
      .stat(underScoreHtmlPath)
      .catch(() => null);
    if (underScoreHtmlStats && underScoreHtmlStats.isFile()) {
      return serveFile(underScoreHtmlPath, req, res);
    }
  }

  // 不再下载远程文件，直接返回 404 或重定向
  const ext = path.extname(originalPath).toLowerCase();
  const parsedUrl = url.parse(req.url);

  logger.info(`404 Not Found: ${decodeURIComponent(parsedUrl.href)}`);

  if (ext === ".html" || ext === "") {
    res.writeHead(302, { Location: "/index.html" });
    res.end("Not found");
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

// Error handling middleware
async function errorHandler({ req, res }, next) {
  try {
    await next();
  } catch (err) {
    logger.error(`Request error: ${err.message}\n${err.stack}`);
    res.statusCode = err.statusCode || 500;
    res.end(
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal Server Error"
    );
  }
}

async function fileExistsCaseInsensitive(basePath) {
  try {
    const dirPath = path.dirname(basePath);
    const fileName = path.basename(basePath);
    const files = await fs.readdir(dirPath);

    // 在Linux上执行大小写不敏感匹配
    const foundFile = files.find(
      (f) => f.toLowerCase() === fileName.toLowerCase()
    );
    return foundFile ? path.join(dirPath, foundFile) : null;
  } catch (error) {
    return null;
  }
}

async function mainHandler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Credentials": "true",
    });
    return res.end();
  }
  await errorHandler({ req, res }, async () => {
    const parsedUrl = url.parse(req.url);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === "/") pathname = "/index.html";

    // const filePath = path.join(config.STATIC_DIR, pathname);
    const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(config.STATIC_DIR, safePath);
    let stats = await fs.stat(filePath).catch(() => null);
    // 1. 直接是文件
    if (stats && stats.isFile()) return serveFile(filePath, req, res);

    // 2. 目录或无后缀，优先查 /xxx.html，再查 /xxx/index.html
    const isDir = stats && stats.isDirectory();
    const noExt = !path.extname(filePath);

    if (isDir || noExt) {
      // /about/ 或 /about → /about.html
      const htmlPath = isDir
        ? path.join(path.dirname(filePath), path.basename(filePath) + ".html")
        : filePath + ".html";
      const htmlStats = await fs.stat(htmlPath).catch(() => null);
      if (htmlStats && htmlStats.isFile()) return serveFile(htmlPath, req, res);

      // /about/ 或 /about → /about/index.html
      const indexPath = path.join(filePath, "index.html");
      const indexStats = await fs.stat(indexPath).catch(() => null);
      if (indexStats && indexStats.isFile())
        return serveFile(indexPath, req, res);
    }

    // 兜底
    await handleMissingFile(filePath, req, res);
  });
}

// const httpServer = http.createServer(mainHandler);

const httpServer = http.createServer(mainHandler);

httpServer.listen(8087, () => {
  console.log("HTTP server running on http://localhost:8087");
});

// // 启动 HTTPS
// const httpsServer = https.createServer(
//   {
//     ...httpsOptions,
//     ciphers: [
//       "TLS_AES_256_GCM_SHA384",
//       "TLS_CHACHA20_POLY1305_SHA256",
//       "TLS_AES_128_GCM_SHA256",
//     ].join(":"),
//     minVersion: "TLSv1.3",
//   },
//   mainHandler
// );
// httpsServer.listen(8087, () => {
//   console.log("HTTPS server running on https://localhost:8087");
// });
