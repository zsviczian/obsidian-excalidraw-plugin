/**
 * Language file formatting tool
 *
 * Purpose:
 *   Format ./locale/{lang}.ts language files, fixing indentation, spaces, comments, etc.
 *
 * Usage:
 *   node langFormatter.js [lang]
 *   Example: node langFormatter.js zh-cn
 *   If lang is not specified, the default is en.
 */
/**
 * 语言文件格式化工具
 *
 * 用途：
 *   格式化 ./locale/{lang}.ts 语言文件，修正缩进、空格、注释等格式问题。
 *
 * 用法：
 *   node langFormatter.js [lang]
 *   例如：node langFormatter.js zh-cn
 *   若未指定 lang，默认格式化 en 语言文件。
 */
const fs = require("fs");
const path = require("path");

const indentStr = "  "  // 缩进字符串，2个空格

const formatter = (lang = "en") => {
    const content = fs.readFileSync(path.join(__dirname, `./locale/${lang}.ts`), "utf8")
                // 添加丢失的换行 | Add missing line breaks
                .replace(/(["`])\s*,\s*([A-z0-9_])\s*:/g, `$1,\n${indentStr}$2:`)
                // 去除过多的空行 | Remove excessive blank lines
                .replace(/\n{3,}/g, "\n\n")
                // 修正正文中的连续空格 | Fix consecutive spaces in text
                .replace(/(\S) {2,}(\S)/g, "$1 $2")
                // 修正键值前后的格式 | Fix formatting around key-value pairs
                .replace(/^[ \t]*([A-Z0-9_]+)[ \t]*:[ \t]*/gm, `${indentStr}$1: `)
                // 去除行尾的空白 | Remove trailing whitespace
                .replace(/[ \t]*$/gm, "")
                // 规范化单行注释的空格 | Normalize spaces in single-line comments
                .replace(/^([ \t]*)\/\/(\S[^\n]*)/gm, `$1// $2`)
                // 规范行尾加号前的空格 | Normalize spaces before plus sign at line end
                .replace(/(["`])\+\n/g, `$1 +\n`)
                // 规范行内加号前后的空格 | Normalize spaces around plus sign inline
                .replace(/([`"]) *\+ *([^+]+) *\+ *([`"])/g, `$1 + $2 + $3`)
    // 汇报不规范的注释 | Report non-standard comments
    content.match(/^\s*\/\/(\S|\s+[^\w]).*$/gm)
        ?.forEach(line => console.warn(`语言文件 ${lang} 中的注释不规范:`, line));
    fs.writeFileSync(path.join(__dirname, `./locale/${lang}.ts`), content, "utf8");
}

// CLI
if (require.main === module) {
    const lang = process.argv[2] || "en";
    formatter(lang)
    console.log("语言文件格式化完成:", lang);
}