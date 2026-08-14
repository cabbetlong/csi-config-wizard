---
name: csi-config-wizard
description: 维护华为 CSI 配置向导（csi-config-wizard 项目）。只要用户提出修改、新增、扩展向导的任意参数或配置——改默认值、选项列表、校验规则、条件显示、协议、产品系列、容器平台、输出 YAML 模板、部署命令、部署自检清单、双语文案——或询问"怎么给向导加参数/改参数/维护配置"，就使用本技能。向导是配置数据驱动的：所有参数定义在 public/config/ 下的 YAML 文件里，改配置通常不需要改代码（仅有少量文档化的钩子例外），改完必须跑 npm test 验证。不要用于与本项目无关的通用 Kubernetes/华为 CSI 部署问题。
compatibility: 项目：csi-config-wizard（Vue 3 + Vite，运行时加载 public/config/）。验证命令：npm test（schema 校验、模板引用完整性、golden 渲染、内嵌快照、组件冒烟）、npm run dev 人工核对、npm run build。
---

# 华为 CSI 配置向导 — 配置维护

## 你要维护的东西（30 秒理解）

向导 = **渲染引擎（代码，几乎不动）** + **配置数据（`public/config/` 的 YAML，日常维护对象）**。

- `fields.yaml` 的**字段定义** → 同时驱动表单 UI、校验规则、条件显示
- `templates/*.yaml` 的**产物模板** → YAML 输出形状（`{{field}}` / `{{#if}}` / `{{#each}}`）
- `families.yaml` → 产品系列 × 业务类型 × 协议矩阵；`helm.yaml` → 容器平台预设
- `pitfalls.yaml` → 部署自检清单；`i18n/{zh,en}.yaml` + 字段内 `label_zh/label_en` → 双语

**为什么这样设计**：客户要求"加配置不改代码"。所以任何参数改动都应尽量落在 YAML 数据层；只有当现有机制表达不了需求时才动代码（只有五种情形，见下）。

## 开始之前：读参考（按需加载，不用全读）

`references/config-guide.md` 是本技能的完整参考（与 `docs/CONFIG-GUIDE.md` 同步）：
- 任何字段改动 → §3 字段定义、§4 条件 DSL、§5 模板语法
- 场景/协议/平台 → §7.1、§8.1；防错清单 → §8.2；命令 → §8.3；多语言 → §8.4
- 需要改代码的情形 → §8.5

## 改参数的核心原则

1. **一个参数通常出现在两处**：`fields.yaml`（表单+校验）+ 对应产物模板（输出）。漏一处 = 表单有但输出没有，或反之。改参数前先定位这两个位置。
2. **字段 id 必须与模板占位符逐字一致**（`id: sc.ioPriority` ↔ `{{sc.ioPriority}}`）。不一致时加载直接报错"模板引用了未定义的字段"——这是防呆设计，不要绕过（不要用不存在的字段名硬塞）。
3. **`default` 只在字段可见时应用**（初始化/可见性切换时），对已存在的数据不追溯。改默认值后若验证没生效，清浏览器 localStorage 再试。
4. **占位符不要手写引号**：写 `qos: {{sc.qos}}`（裸占位符），引擎会自动选正确的 YAML 引号风格（含 `:` `{` 的字符串自动加引号、数字/布尔原样）。写 `qos: '{{sc.qos}}'` 会造成引号重复、内容损坏。
5. **YAML 陷阱**：值里出现 `: `（冒号+空格）或值以 `:` 结尾时必须整体加引号；中文全角冒号 `：` 安全；反斜杠在 YAML 双引号里要写成 `\\`（正则尤其注意）。
6. **需要改代码的情形只有五种**，其余一律数据解决：① 新字段类型 ② 新 `options_from` 来源 ③ 新校验钩子 ④ 新跨字段联动/重置逻辑 ⑤ 新产物类型。详见 references §8.5。

## 标准流程：修改/新增任意步骤的参数

1. `public/config/fields.yaml`：加/改字段定义——`id`（`<产物>.<名称>`）、`label_zh`/`label_en`（必填，缺则 schema 报错）、`type`、`level`（basic 平铺 / advanced 折叠）、`default`、`required`、`validate`（pattern/min/max/enum）、`visible_when`/`required_when`、`options` 或 `options_from`、`hook`
2. `public/config/templates/<产物>.yaml`：加/改占位符——普通参数直接一行；条件参数包 `{{#if ...}}`；列表用 `{{#each ...}}`；标记行必须独占一行
3. 需要条件显示 → `visible_when`/`required_when`（条件 DSL 见 references §4）
4. 需要下拉选项 → `options`（静态）或 `options_from`（`family.protocols` / `state.backends` / `state.backendPools`）
5. 补文案：字段 label/help 写在字段定义里；协议/平台/业务类型名与 UI 文案写 `i18n/{zh,en}.yaml`
6. **验证（必须）**：
   - `npm test` 全绿——它覆盖 schema 校验、模板引用完整性、golden 渲染、内嵌快照一致性、组件冒烟
   - 有意改变输出结构时，同步更新 `tests/golden.test.js` 的期望字符串（golden 是"输出被改坏"的护栏，别让它红着交差）
   - `npm run dev` 人工走一遍受影响步骤
   - 涉及输出结构的新字段，建议补渲染断言或 golden 用例

## 分步骤速查（详情见 references §7）

| 步骤 | 字段前缀 | 主要改动文件 | 典型任务 |
|---|---|---|---|
| 场景问答 | scenario.* | families.yaml / helm.yaml / i18n | 新增协议、产品系列、业务类型、平台 |
| Step1 CSI 安装 | helm.* | fields.yaml + templates/helm-values.yaml | 改镜像仓库、副本数、日志级别、多路径等默认值 |
| Step2 存储后端 | backend.* | fields.yaml + templates/backend.yaml | 新增后端参数、按协议条件显示的字段、多后端 |
| Step3 存储类 | sc.* | fields.yaml + templates/storageclass.yaml | 新增 SC 参数、下拉选项（后端列表/存储池） |
| Step4 PVC | pvc.* | fields.yaml + templates/pvc.yaml | 新增 PVC 参数、标签、访问模式 |

## 需要改代码时的最小路径（references §8.5）

- **新校验钩子**：`src/hooks/index.js` 注册（函数返回 `null`=通过，字符串=错误消息的 i18n key），字段里 `hook: <id>` 引用；配置引用了未注册钩子 → 加载报错
- **新 options_from 来源**：`src/components/FieldInput.vue` 的 `resolveOptions` + `src/engine/schemas.js` 的枚举
- 改完代码照常 `npm test`。

## 交付检查清单

- [ ] 只动了该动的文件（配置为主；代码仅五种情形）
- [ ] 字段 id ↔ 模板占位符逐字一致
- [ ] `label_zh` / `label_en` 都给了（缺则 schema 报错）
- [ ] 新增协议/平台/业务类型在 i18n 里有名字（否则下拉显示原始 id）
- [ ] `npm test` 全绿；golden 期望已同步（如输出结构变化）
- [ ] 输出符合官方 CSI 文档事实（字段名拼写、协议→portals 规则等，拿不准去查 css-docs）
