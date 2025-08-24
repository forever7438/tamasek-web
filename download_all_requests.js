const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs-extra");
const path = require("path");
const { URL } = require("url");

// let pLimit;
let pLimit, fetch;
async function preloadModules() {
  const [{ default: pLimitMod }, { default: fetchMod }] = await Promise.all([
    import("p-limit"),
    import("node-fetch"),
  ]);
  pLimit = pLimitMod;
  fetch = fetchMod;
}

puppeteer.use(StealthPlugin());

const CONFIG = {
  baseUrl: "https://www.temasek.com.sg/",
  outputDir: "./arcano_download",
  navigationTimeout: 600000,
  maxConcurrency: 5,
  retryAttempts: 3,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

const FILE_PATHS = fs
  .readFileSync(path.resolve(__dirname, "404File"), "utf-8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => {
    if (!line || line.startsWith("//")) return false;
    // if (/(.)\1{2,}/.test(line)) {
    //   console.warn("⚠️ 路径可能有拼写错误，已跳过:", line);
    //   return false; // 直接跳过
    // }
    return true;
  });

const state = {
  success: new Set(),
  failed: {
    404: new Set(),
    other: new Map(),
  },
};

// const fileUrls = FILE_PATHS.map((p) => new URL(p, CONFIG.baseUrl).href);
let fileUrls = FILE_PATHS.map((p) => new URL(p, CONFIG.baseUrl).href).map(
  decodeURIComponent
);

fileUrls = Array.from(new Set(fileUrls));

console.log("fileUrls", fileUrls);

function generateSafePath(url) {
  const parsedUrl = new URL(url);
  let pathname = parsedUrl.pathname;
  // 如果以 / 结尾或为空，默认 index.html
  if (pathname.endsWith("/") || pathname === "") {
    pathname = pathname + "index.html";
  }
  const pathSegments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      decodeURIComponent(segment).replace(/[<>:"/\\|?*]/g, "_")
    );
  return path.join(CONFIG.outputDir, parsedUrl.hostname, ...pathSegments);
}

class DownloadManager {
  constructor() {
    this.browser = null;
    this.headersConfig = {
      common: {
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,zh-HK;q=0.7,it;q=0.6",
        "cache-control": "no-cache",
        dnt: "1",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      },
      html: {
        accept:
          "text/html",
        priority: "u=0, i",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
      },
      css: {
        accept: "text/css,*/*;q=0.1",
        priority: "u=0",
        "sec-fetch-dest": "style",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "same-origin",
      },
      js: {
        accept: "*/*",
        priority: "u=1",
        "sec-fetch-dest": "script",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "same-origin",
      },
      img: {
        accept:
          "image/avif",
        priority: "u=2, i",
        "sec-fetch-dest": "image",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "same-origin",
      },
    };
    // 精确的Cookie值
    this.cookieStr = ""
    this.cookiesForPuppeteer = [

    ];
  }

  async initialize() {
    this.browser = await puppeteer.launch({
      headless: "new",
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--window-size=1920,1080",
      ],
      ignoreHTTPSErrors: true,
    });
  }

  async updateCookies(page) {
    await page.goto(CONFIG.baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: CONFIG.navigationTimeout,
    });
    return await page.cookies();
  }

  async createPage() {
    const page = await this.browser.newPage();
    await page.setUserAgent(this.headersConfig.common["user-agent"]);
    await page.setViewport({ width: 1920, height: 1080 });

    await this.updateCookies(page);

    // 反检测：隐藏 webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.chrome = { runtime: {} };
    });

    // 反检测设置
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.chrome = { runtime: {} };
    });

    await page.evaluateOnNewDocument(() => {
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) return "Intel Open Source Technology Center";
        if (parameter === 37446) return "Mesa DRI Intel(R) HD Graphics 4000";
        return getParameter.call(this, parameter);
      };
    });

    // 设置精确的请求头
    await page.setExtraHTTPHeaders({
      ...this.headersConfig.common,
      ...this.headersConfig.html,
    });

    // 设置精确的Cookie
    await page.setCookie(...this.cookiesForPuppeteer);

    return page;
  }

  async downloadFile(url) {
    let attempt = 0;
    const ext = path.extname(url).toLowerCase();
    const isStatic = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".webp",
      ".woff",
      ".woff2",
      ".ttf",
      ".otf",
      ".eot",
      ".pdf",
      ".zip",
      ".mp4",
      ".map",
    ].includes(ext);

    while (attempt <= CONFIG.retryAttempts) {
      try {
        if (isStatic) {
          // 优先用 fetch，失败后用 puppeteer 拦截下载
          // 根据文件类型获取特定的请求头
          let typeHeaders = {};
          if (ext === ".css") typeHeaders = this.headersConfig.css;
          else if (ext === ".js") typeHeaders = this.headersConfig.js;
          else if (
            [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)
          )
            typeHeaders = this.headersConfig.img;

          // 合并通用头和特定头
          const fetchHeaders = {
            ...this.headersConfig.common,
            ...typeHeaders,
            Cookie: this.cookieStr,
          };

          let res;
          try {
            res = await fetch(url, {
              headers: fetchHeaders,
            });
          } catch {
            res = null;
          }

          if (res && res.status === 200) {
            await this.saveBuffer(res, url);
            console.log(`✅ 下载成功: ${url}`);
            return true;
          }

          // fetch 失败，尝试用 puppeteer 拦截下载
          const page = await this.createPage();

          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: CONFIG.navigationTimeout,
          });
          console.log(response);

          const status = response && response.status ? response.status() : 0;
          if (status === 200) {
            try {
              const buffer = await response.buffer();
              const savePath = generateSafePath(url);
              await fs.ensureDir(path.dirname(savePath));
              await fs.writeFile(savePath, buffer);
              state.success.add(url);
              console.log(`✅ 下载成功: ${url}`);
            } catch (e) {
              this.recordOtherError("BUFFER_ERROR", url);
              console.error(`❌ buffer 读取失败: ${url}`, e);
            }
            await page.close();
            return true;
          }
          if (status === 404) {
            state.failed["404"].add(url);
            console.error(`❌ 文件不存在: ${url}`);
            await page.close();
            return false;
          }
          this.recordOtherError(status, url);
          await page.close();
          return false;
        } else {
          const page = await this.createPage();
          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: CONFIG.navigationTimeout,
          });

          const status = response.status();
          if (status === 200) {
            const buffer = await response.buffer();
            const savePath = generateSafePath(url);
            await fs.ensureDir(path.dirname(savePath));
            await fs.writeFile(savePath, buffer);
            state.success.add(url);
            console.log(`✅ 下载成功: ${url}`);
            await page.close();
            return true;
          }
          if (status === 404) {
            state.failed["404"].add(url);
            console.error(`❌ 文件不存在: ${url}`);
            await page.close();
            return false;
          }
          this.recordOtherError(status, url);
          await page.close();
          return false;
        }
      } catch (error) {
        console.error(
          `⚠️ 请求失败: ${url} (尝试 ${attempt + 1}/${CONFIG.retryAttempts})`,
          error.message || error
        );
        attempt++;
        if (attempt > CONFIG.retryAttempts) {
          this.recordOtherError(error.message || "NETWORK_ERROR", url);
          return false;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  }

  async saveBuffer(res, url) {
    // node-fetch v3 推荐用 arrayBuffer
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const savePath = generateSafePath(url);
    await fs.ensureDir(path.dirname(savePath));
    await fs.writeFile(savePath, buffer);
    state.success.add(url);
  }

  recordOtherError(status, url) {
    if (!state.failed.other.has(status)) {
      state.failed.other.set(status, new Set());
    }
    state.failed.other.get(status).add(url);
    console.error(`⚠️ 请求异常 [${status}]: ${url}`);
  }

  async shutdown() {
    await this.browser.close();
  }
}

function generateReport() {
  console.log("\n下载结果汇总:");
  console.log(`✅ 成功下载: ${state.success.size} 个文件`);
  console.log(`❌ 404 文件: ${state.failed["404"].size} 个`);
  state.failed.other.forEach((urls, status) => {
    console.log(`⚠️ 错误代码 ${status}: ${urls.size} 个文件`);
  });
}

async function main() {
  console.log(`开始下载 ${fileUrls.length} 个文件...`);
  await preloadModules();

  while (!pLimit || !fetch) {
    await new Promise((r) => setTimeout(r, 50));
  }

  await fs.emptyDir(CONFIG.outputDir);
  const manager = new DownloadManager();
  await manager.initialize();

  const limit = pLimit(CONFIG.maxConcurrency);
  const tasks = [];
  let idx = 0;
  for (const url of fileUrls) {
    if (state.success.has(url) || state.failed["404"].has(url)) continue;
    idx++;
    const currentIdx = idx; // 保证闭包内序号正确
    tasks.push(
      limit(() => {
        console.log(`[${currentIdx}/${fileUrls.length}] 开始下载: ${url}`);
        return manager.downloadFile(url);
      })
    );
  }

  try {
    await Promise.all(tasks);
  } finally {
    await manager.shutdown();
    generateReport();
  }
}

main().catch((err) => {
  console.error("程序异常终止：", err);
  process.exit(1);
});
