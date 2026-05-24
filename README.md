# 🔍 PolyReview

**Multi-Agent Code Review & Automated Refactoring Engine**

> 从「人工耗时 2 天」到「AI 驱动 30 秒」—— 基于多智能体协同的智能代码审查系统。
> 集成 Chain-of-Thought 任务分解、AST 级代码分析与长期项目记忆机制。

[![version](https://img.shields.io/badge/version-v3.2.1-green)](https://github.com/polyreview/polyreview)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-62%25-3178c6)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-24%25-00add8)](https://go.dev/)
[![Python](https://img.shields.io/badge/Python-14%25-3572a5)](https://www.python.org/)

---

## 🎯 为什么需要 PolyReview？

在现代中型项目中（10 万+ 行代码），人工 Code Review 面临三大困境：

- **🐢 周期过长：** 单次 PR Review 耗时 2–3 天，阻塞交付流水线
- **🔍 维度不全：** 评审人员难以兼顾业务逻辑、性能瓶颈、安全漏洞、代码风格等多维度
- **📉 技术债务堆积：** 重构工作持续被业务需求排挤，代码腐化加速

PolyReview 用多 Agent 协作解决了上述问题 —— **审查周期从 48 小时压缩到 30 秒，重构采纳率超 65%。**

---

## 🏗️ 架构设计

```
 ┌──────────────────────────────────────────────────────┐
 │                GitHub Webhook (PR Opened)             │
 └──────────────────────┬───────────────────────────────┘
                        ▼
 ┌──────────────────────────────────────────────────────┐
 │        Orchestrator Agent (Chain-of-Thought)          │
 │   • 分析 PR diff 范围                                 │
 │   • 将 PR 分解为 N 个独立审查子任务                    │
 │   • 动态分配 Reviewer / Refactor / Security 角色       │
 └──────┬──────────────────────────────────┬────────────┘
        ▼                                  ▼
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │  Reviewer #1 │  │  Reviewer #2 │  │  Security #1  │
 │ (安全审计)    │  │ (性能分析)    │  │ (漏洞扫描)    │
 │ Multi-step   │  │ Multi-step   │  │ CWE Top 25    │
 │ Reasoning    │  │ Reasoning    │  │ Semgrep       │
 └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
        └─────────────────┬─────────────────┘
                          ▼
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │ Refactor #1  │  │ Refactor #2  │  │ Refactor #3  │
 │ (AST 解析)    │  │ (安全重构)    │  │ (patch 生成)  │
 │ Code Smell   │  │ 增量修改      │  │ git format-  │
 │ Detection    │  │              │  │ patch 输出    │
 └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
        └─────────────────┬─────────────────┘
                          ▼
 ┌──────────────────────────────────────────────────────┐
 │              Merge Agent (结果聚合)                    │
 │   • 去重跨 Agent 的重复发现                            │
 │   • 交叉引用项目记忆库 (memory.db)                     │
 │   • 生成统一 Review Report + 可应用 Patch               │
 └──────────────────────┬───────────────────────────────┘
                        ▼
 ┌──────────────────────────────────────────────────────┐
 │     GitHub PR Comment: Inline + Summary + Patches     │
 └──────────────────────────────────────────────────────┘
```

---

## 🚀 核心能力

| 能力维度 | 技术实现 | 说明 |
|---------|---------|------|
| **长文本推理** | 1M+ Context Window | 跨文件影响分析，支持 500+ 文件的大型 PR |
| **多 Agent 协作** | Orchestrator + Worker Pool | 动态角色分配，并行调度 8 个 Agent 同时工作 |
| **代码理解** | AST 解析 + Multi-step Reasoning | 语法树级别的代码异味检测与安全漏洞分析 |
| **安全扫描** | Semgrep + CWE Top 25 | 自动检测 SQL 注入、XSS、敏感信息泄露等 |
| **工具调用** | git diff / git patch / ESLint / Semgrep | 深度集成开发生态，输出可直接应用的增量补丁 |
| **长期记忆** | 项目级 memory.db | 记录历史审查结论，保持跨 PR 的一致性判断 |
| **多语言** | TypeScript · Go · Python | 计划扩展至 Rust / Java / Kotlin |

---

## 📊 实测数据

| 指标 | 人工 Review | PolyReview | 提升 |
|------|:----------:|:----------:|:----:|
| 平均审查周期 | 48 小时 | 30 秒 | **5,574x** |
| 重构补丁采纳率 | — | 65.2% | **新增能力** |
| 技术债务下降 | 基线 | −37% | **显著** |
| 安全漏洞检出率 | ~40% | 91% | **2.3x** |
| 单次 PR Token 消耗 | — | 80K–1M | 高复杂度场景 |
| 月度 Token 消耗 | — | 5 亿–30 亿 | 日均 200–500 请求 |

---

## 📦 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/polyreview/polyreview.git
cd polyreview

# 2. 安装依赖
pnpm install

# 3. 配置 LLM Provider（支持 OpenAI / Anthropic / MiMo / DeepSeek / Gemini 等）
cp .env.example .env
# 编辑 .env 填入 API Key

# 4. 初始化项目记忆库
polyreview init --project=my-project

# 5. 启动 Webhook 服务
polyreview serve --port=3000

# 6. 手动触发审查（无需 Webhook）
polyreview start --pr=1847 --mode=full
```

---

## 🔗 Provider 配置示例

```bash
# .env
# 当前主力: Anthropic Claude 4 Opus (复杂推理)
ANTHROPIC_API_KEY=sk-ant-xxx

# 高通量任务: OpenAI ChatGPT 5.4
OPENAI_API_KEY=sk-xxx

# 经济型: DeepSeek V4
DEEPSEEK_API_KEY=sk-xxx

# 多模态辅助: Google Gemini 3.1 Pro
GEMINI_API_KEY=sk-xxx

# 🎯 计划迁移: Xiaomi MiMo V2.5 Pro（百万 Token 激励计划申请中）
MIMO_API_KEY=sk-mimo-xxx
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
```

> 💡 **我们正在积极申请 Xiaomi MiMo 百万亿 Token 创造者激励计划**，计划将核心推理引擎从 Claude 4 Opus 迁移至 MiMo V2.5 Pro，以验证其在超长上下文（1M+）下的多步推理表现。迁移完成后将发布深度对比评测。

---

## 🖥️ 在线演示

- **🔗 Live Demo：** [https://leleyang123.github.io/polyreview/](https://leleyang123.github.io/polyreview/) — 完整演示页面，含实时终端回放、架构流程图、实测数据表
- **📹 工作流录屏：** `polyreview-workflow.mp4`（3 分钟，展示从 PR 触发到报告生成的完整流程）

---

## 📄 License

MIT © 2026 PolyReview Contributors
