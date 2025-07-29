/**
 * Language Pack Diff Checker Script
 *
 * Purpose:
 *   Compare src/lang/locale/en.ts and a target language file (e.g. zh-cn.ts), output missing and extra keys.
 *   Output is color-coded:
 *     - Green: Key exists in en.ts but missing in the target language file
 *     - Red:   Key exists in the target language file but not in en.ts
 *     - Yellow: The same key exists in both files but the line numbers are different
 *
 * Dependencies:
 *   Node.js environment, no extra dependencies required.
 *
 * Usage:
 *   1. Open a terminal in this file's directory (or project root).
 *   2. Run:
 *      node src/lang/langDiffWithEn.js zh-cn
 *      # or node src/lang/langDiffWithEn.js ja
 *      # The argument is the language file name (without extension), default is zh-cn
 *
 * Output:
 *   + (green): Key exists in en.ts but missing in the target language file
 *   - (red):   Key exists in the target language file but not in en.ts
 *   ! (yellow): The same key exists in both files but the line numbers are different
 *   If there is no output, the two files have identical keys.
 */
/**
 * 语言包差异检测脚本
 *
 * 用途：
 *   比较 src/lang/locale/en.ts 与指定语言文件（如 zh-cn.ts）中的 key，输出缺失和多余的 key。
 *   输出内容会用不同颜色区分：
 *     - 绿色：en.ts 有但目标语言缺失的 key
 *     - 红色：目标语言有但 en.ts 没有的 key
 *     - 黄色：相同的 key 所在的行号不相同
 *
 * 依赖：
 *   Node.js 环境，无需额外依赖。
 *
 * 用法：
 *   1. 在命令行进入本文件所在目录（或项目根目录）。
 *   2. 运行：
 *      node src/lang/langDiffWithEn.js zh-cn
 *      # 或 node src/lang/langDiffWithEn.js ja
 *      # 参数为语言文件名（不带扩展名），默认为 zh-cn
 *
 * 输出说明：
 *   + 开头（绿色）：en.ts 有但目标语言缺失的 key
 *   - 开头（红色）：目标语言有但 en.ts 没有的 key
 *   ! 开头（黄色）：相同的 key 所在的行号不相同
 *   若无输出则表示两个文件 key 完全一致。
 */

const fs = require("fs");
const path = require("path");

/**
 * 读取 locale 文件夹下指定语言和 en.ts 文件，逐行解析键值和行号
 * @param lang 语言文件名（不含扩展名），如 zh-cn
 * @returns { en: Record<string, {value: string, line: number}>, lang: Record<string, {value: string, line: number}> }
 */
function readLocaleFiles(lang = "zh-cn") {
  // 构造 locale 目录路径
  const localeDir = path.join(__dirname, "./locale");
  // 获取 en.ts 文件路径
  const enFile = path.join(localeDir, "en.ts");
  // 获取指定语言文件路径
  const langFile = path.join(localeDir, `${lang}.ts`);
  /**
   * 解析指定的语言文件，提取每个 key 的值和所在行号
   * @param file 文件路径
   * @returns {Record<string, {value: string, line: number}>}
   */
  const parse = (file) => {
    // 读取文件内容并按行分割
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const result = {};
    let inExport = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 检查是否进入 export default 块
      if (!inExport && line.includes("export default")) {
        inExport = true;
        continue;
      }
      if (!inExport) continue;
      // 匹配 key: "value", 格式的行
      const m = line.match(/^\s*([A-Z0-9_]+)\s*:\s*.*?,?$/);
      if (m) {
        let key = m[1];
        // 保存 key 及其所在行号
        result[key] = i + 1;
      }
    }
    return result;
  };
  // 返回 en 和指定语言的解析结果
  return {
    en: parse(enFile),
    lang: parse(langFile),
  };
}

/**
 * 比较 en 和 lang 的 key/value，输出差异
 */

function diffLang(lang = "zh-cn") {
  const { en, lang: l } = readLocaleFiles(lang);
  const allKeys = new Set([...Object.keys(en), ...Object.keys(l)]);
  const diffs = [];
  for (const key of allKeys) {
    if (!(key in en)) {
      diffs.push(`- ${key}: ${l[key]}`);
    } else if (!(key in l)) {
      diffs.push(`+ ${key}: ${en[key]}`);
    } else {
      if (en[key] !== l[key]) {
        diffs.push(`! ${key}: en: ${en[key]} <--> lang: ${l[key]}`);
      }
    }
  }
  return diffs;
}

// CLI
if (require.main === module) {
  const lang = process.argv[2] || "zh-cn";
  const diffs = diffLang(lang);
  if (diffs.length === 0) {
    console.log(`语言文件 ${lang} 与 en.ts 无差异`);
  } else {
    diffs.forEach((line) => {
      if (line.startsWith("+")) {
        // 绿色
        console.log("\x1b[32m%s\x1b[0m", line);
      } else if (line.startsWith("-")) {
        // 红色
        console.log("\x1b[31m%s\x1b[0m", line);
      } else if (line.startsWith("!")) {
        // 黄色
        console.log("\x1b[33m%s\x1b[0m", line);
      } else {
        // 默认
        console.log(line);
      }
    });
  }
}