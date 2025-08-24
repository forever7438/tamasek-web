const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs-extra");
const path = require("path");
const { URL } = require("url");

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
  navigationTimeout: 60000, // Reduced from 600000 for faster retries
  maxConcurrency: 2, // Lowered from 5 to reduce server load
  retryAttempts: 3,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
};

const FILE_PATHS = fs
  .readFileSync(path.resolve(__dirname, "404File"), "utf-8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("//"));

const state = {
  success: new Set(),
  failed: {
    404: new Set(),
    other: new Map(),
  },
};

let fileUrls = Array.from(
  new Set(
    FILE_PATHS.map((p) => decodeURIComponent(new URL(p, CONFIG.baseUrl).href))
  )
);

console.log("fileUrls", fileUrls);

function generateSafePath(url) {
  const parsedUrl = new URL(url);
  let pathname = parsedUrl.pathname || "/index.html";
  if (pathname.endsWith("/")) pathname += "index.html";
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
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "user-agent": CONFIG.userAgent,
      },
      html: { accept: "text/html" },
      css: { accept: "text/css,*/*;q=0.1" },
      js: { accept: "*/*" },
      img: { accept: "image/avif" },
      // img: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    };
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
    // Simulate user behavior: scroll down the page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 1000)); // Wait 1s
    return await page.cookies();
  }

  async createPage() {
    const page = await this.browser.newPage();
    await page.setUserAgent(CONFIG.userAgent);
    await page.setViewport({ width: 1920, height: 1080 });

    // Anti-detection measures
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.chrome = { runtime: {} };
    });

    // Fetch and set fresh cookies
    const cookies = await this.updateCookies(page);
    await page.setCookie(...cookies);

    return page;
  }

  async downloadFile(url) {
    let attempt = 0;
    const ext = path.extname(url).toLowerCase();
    const isStatic = [".png", ".jpg", ".css", ".js", ".pdf", ".svg"].includes(
      ext
    );

    while (attempt <= CONFIG.retryAttempts) {
      const page = await this.createPage();
      try {
        // Set headers based on file type
        const type = isStatic
          ? ext === ".css"
            ? "css"
            : ext === ".js"
            ? "js"
            : "img"
          : "html";
        await page.setExtraHTTPHeaders({
          ...this.headersConfig.common,
          ...this.headersConfig[type],
          Referer: CONFIG.baseUrl,
        });
        console.log("s-net-zero-nature-positive-inclusive-growth", url);

        const response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: CONFIG.navigationTimeout,
        });

        const status = response?.status() || 0;
        const statusText = response?.statusText() || "Unknown";

        if (status === 200) {
          const buffer = await response.buffer();
          const savePath = generateSafePath(url);
          await fs.ensureDir(path.dirname(savePath));
          await fs.writeFile(savePath, buffer);
          state.success.add(url);
          console.log(`✅ 下载成功: ${url}`);
          await page.close();
          return true;
        } else if (status === 404) {
          state.failed["404"].add(url);
          console.error(`❌ 文件不存在: ${url}`);
          await page.close();
          return false;
        } else if (statusText.includes("Access Denied")) {
          console.warn(`⚠️ Access Denied: ${url}, 尝试更新Cookie并重试`);
          attempt++;
          if (attempt > CONFIG.retryAttempts) {
            this.recordOtherError("ACCESS_DENIED", url);
            await page.close();
            return false;
          }
        } else {
          this.recordOtherError(status, url);
          await page.close();
          return false;
        }
      } catch (error) {
        console.error(
          `⚠️ 请求失败: ${url} (尝试 ${attempt + 1}/${CONFIG.retryAttempts})`,
          error.message
        );
        attempt++;
        if (attempt > CONFIG.retryAttempts) {
          this.recordOtherError(error.message || "NETWORK_ERROR", url);
          await page.close();
          return false;
        }
        // Exponential backoff with random delay
        await new Promise((r) =>
          setTimeout(r, Math.random() * 5000 + 1000 * Math.pow(2, attempt))
        );
      }
    }
  }

  recordOtherError(status, url) {
    if (!state.failed.other.has(status))
      state.failed.other.set(status, new Set());
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
  await fs.emptyDir(CONFIG.outputDir);

  const manager = new DownloadManager();
  await manager.initialize();

  const limit = pLimit(CONFIG.maxConcurrency);
  const tasks = fileUrls.map((url, idx) =>
    limit(async () => {
      console.log(`[${idx + 1}/${fileUrls.length}] 开始下载: ${url}`);
      await new Promise((r) => setTimeout(r, Math.random() * 2000)); // Random delay
      return manager.downloadFile(url);
    })
  );

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
