# Example 模块使用示例

## 1. 概述

> **Scope**：说明问题身份的演示调用，不提供源码事实自动校验。

问题身份不包含行号。移动行不改变身份。

身份依据：{{../../../../scripts/lib/quality-report.js:22-28}}。

## 4. 术语表

| 术语 | 定义 |
|---|---|
| 问题 | 一项检测结果 |
| 基线 | 同配置的先前报告 |

本例将问题和基线分别保存。正文示例没有禁用名称。

```json
{"version":1,"terms":[{"canonical":"问题","forbidden":["缺陷项"]}]}
```

Sources：{{../../../../scripts/lib/quality-report.js:55-83}}。

## 8. API 示例

下面展示身份输入字段。代码中的占位符不会当正文检查。

```javascript
const { issue } = require("./scripts/lib/quality-report");
const finding = issue({file:"example.md", rule:"placeholder", severity:"error", message:"{{CODE_ONLY}}"});
```

返回对象包含 id、file、rule、severity 和 message。位置字段只有显式提供时才附加。

Sources：{{../../../../scripts/lib/quality-report.js:22-28}}。
