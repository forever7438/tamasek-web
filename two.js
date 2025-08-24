const fs = require("fs");
const path = require("path");// 支持的文本文件类型
const exts = [".html", ".htm", ".js", ".css"];// 资源链接正则
const regexps = [
  /<img[^>]+src=["']([^"']+)["']/gi,
  /<script[^>]+src=["']([^"']+)["']/gi,
  /<link[^>]+href=["']([^"']+)["']/gi,
  /url\((['"]?)([^'")]+)\1\)/gi,
  /src=["']([^"']+)["']/gi,
  /href=["']([^"']+)["']/gi,
];// 递归获取所有文件


function getAllFiles(dir, files = []) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过 node_modules 文件夹
      if (entry.name === "node_modules") return;
      getAllFiles(fullPath, files);
    } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  });
  return files;
}

// 提取资源链接
function extractLinksFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const links = new Set();
  for (const re of regexps) {
    let match;
    while ((match = re.exec(content))) {
      // 取第一个非空分组
      const link = match[2] || match[1];
      if (link && !link.startsWith("data:")) {
        links.add(link);
      }
    }
  }
  return Array.from(links);
}// 主流程
const rootDir = process.cwd();
const files = getAllFiles(rootDir);
const allLinks = new Set();files.forEach((file) => {
  extractLinksFromFile(file).forEach((link) => allLinks.add(link));
});fs.writeFileSync(
  "all_resources.txt",
  Array.from(allLinks).sort().join("\n"),
  "utf-8"
);console.log(`已提取资源链接数量: ${allLinks.size}`);
console.log("结果已保存到 all_resources.txt");