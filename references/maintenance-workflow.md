# 文档维护工作流程（增量更新已有文档）

> 生成是冷启动，维护是常态。真实项目里 90% 的文档工作是"代码改了，文档跟上"，
> 不是从零生成。本流程解决三个维护期问题：**漂移检测**（哪些文档过时了）、
> **最小改动**（只修漂移的部分，不重写全文）、**基线防回归**（修 A 不能坏 B）。
>
> 来源：2026-08-24 hdsa-maco 项目两轮实战回灌（见文末实战记录）。

## 适用场景

| 场景 | 触发 | 走哪条路 |
|------|------|---------|
| 代码改了，已知哪些文档受影响 | 用户点名 / commit 关联 | 快路径：直接派 analyzer 核对 |
| 怀疑文档漂移，不知道哪些过期 | 周期性维护 | 慢路径：drift 扫描 → 核对 → 修订 |
| 文档整体失效（叙事级漂移） | 核对发现签名/机制全错 | 重写受影响章节（保留仍然正确的部分） |

## 慢路径：Drift 扫描（阶段 M0）

**执行者**：主 agent，纯 git/文件操作，不派 subagent。

```bash
# 1. 找上次文档对齐点（arch 文档的最后一次大版本 commit）
git log -1 --format="%H %ad" -- doc/<主文档>.md

# 2. 列出此后触碰源码的 commit
git log --oneline <对齐点>..HEAD -- src/ tests/

# 3. 对每个有 tech-doc 的模块，对比 doc vs code 最后提交日期
for doc in doc/tech-docs/*_Design.md; do
  name=$(basename "$doc" _Design.md)
  doc_last=$(git log -1 --format="%ad" --date=short -- "$doc")
  code_last=$(git log -1 --format="%ad" --date=short -- "$(src-path-of $name)")
  [ "$code_last" \> "$doc_last" ] && echo "DRIFT: $name doc=$doc_last code=$code_last"
done
```

**产出**：漂移模块清单。每项标注预期漂移类型（从相关 commit message 推断：
`feat(x)` → 新机制缺失；`fix(x)` → 行为描述过时；`refactor(x)` → 叙事级失效）。

## 快路径 + 慢路径共用：核对分析（阶段 M1）

**执行者**：并行派 analyzer subagent（2-3 个一批）。

**Prompt 模板（核对型，与生成型分析的关键差异——先给已知线索）**：

```
[DEPENDENCY] 仓库根 <path>。核查 doc/tech-docs/<Name>_Design.md（V<x>, <n>行）
与当前 <src files> 的漂移。

文档已知缺：①<线索1> ②<线索2>（来自 commit 分析，可能是对的也可能不全）

请读文档全文 + 源码全文，输出：
1. 漂移清单表：| 文档章节(行) | 源码事实(file:line) | 建议改动 | 严重度 🔴🟠🟡 |
   🔴 = API/行为失真（误导实现者）；🟠 = 事实/引用过时；🟡 = 补充性缺失
2. <新机制> 的完整说明素材（写文档用：动机/表格/机制要点，全带 file:line）
3. 附带发现：文档快照之后源码全部新增 API/回调/字段表
```

**铁律**：给 analyzer 的"已知缺"线索只是引导——它必须**全文核对**并报告你没想到的漂移。
实战中 analyzer 的附带发现（如"典型用法示例调用了不存在的 API"）往往比预期线索严重。

## 修订执行（阶段 M2）

**执行者**：主 agent。

1. 按 analyzer 漂移清单逐项修改，🔴 优先
2. **保留仍然正确的部分**——维护不是重写。没有漂移证据的章节不动
3. 行号引用全量刷新（漂移清单里的 file:line 是新坐标）
4. 文档头部元数据同步：版本号 +1（小修 x.y+1，叙事级重写 x+1.0）、行数、"最后更新"、变更历史表加行
5. 每份改完：`node $SKILL_ROOT/scripts/md-to-html.js --type module --force <file>.md`

## 基线对比防回归（阶段 M3）

> **核心方法**：validate-doc.js 的错误数在存量文档上**不可能一次清零**（历史欠账）。
> 维护的唯一硬指标是：**修订前后错误集合完全一致**（不新增）。

```bash
# 修订前跑一次，存基线
node validate-doc.js --all > /tmp/before.txt 2>&1

# 修订后再跑，diff 错误行（忽略 warning）
node validate-doc.js --all > /tmp/after.txt 2>&1
diff <(grep '✗' /tmp/before.txt) <(grep '✗' /tmp/after.txt) && echo "BASELINE-EQUAL"
```

**判读**：
- diff 为空 → ✅ 无回归
- 出现 `<`（错误消失）→ 净改善（记录下来）
- 出现 `>`（新错误）→ ❌ 回归，必须修掉再交付

**注意**：用哪个版本的 md-to-html.js 生成 HTML 会影响校验结果（如中文 heading id
支持是后加的）。维护时用 skill 最新脚本重新生成**修订过的**文档即可，不要顺手
--all 重刷全部（会把没改的文档也变成新脚本的输出，diff 无法归因）。

## 独立审核（阶段 M4）

与生成流程的阶段 4 相同（reviewer subagent + 6 维评分），差异：
- 审核 prompt 聚焦**修订的章节**而非全文（全文审核对大文档是浪费）
- 明确列出本轮改动点，让 reviewer 针对性抽查 file:line
- 修订清单执行后**重跑 M3 基线对比**（修订本身也可能引入回归）

## 实战记录（回灌来源）

| 日期 | 项目 | 发现 |
|------|------|------|
| 2026-08-24 | hdsa-maco 第一轮（arch 文档） | reviewer 抓出 3 个 P1：参数名系统性错误（fVolume vs volume int32）、"✅直接读"实际下游零消费、ADR 计数过期。**教训：表格里"绑定状态"列必须经源码 grep 验证，不能沿用旧行** |
| 2026-08-24 | hdsa-maco 第二轮（tech-docs） | analyzer 附带发现远超预期线索：McActionBindingTable 文档叙事级失效（2 参签名/fromCycle 已全部改 3 参/trace.param）、HdsApp 典型用法示例调用不存在的 API。**教训：drift 扫描要对比 doc/code 提交日期，不能只看用户点名的文档** |

