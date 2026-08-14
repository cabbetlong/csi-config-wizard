# 华为 CSI 配置向导（csi-config-wizard）

引导客户逐步生成华为 CSI 部署所需的全部 YAML：`helm-values.yaml` → `backend.yaml`（oceanctl）→ `storageclass.yaml` → `pvc.yaml`，解决"步骤多、配置繁杂、易出错"的痛点。

完整设计文档见 [docs/DESIGN.md](docs/DESIGN.md)；**在任意步骤修改/新增参数的操作手册见 [docs/CONFIG-GUIDE.md](docs/CONFIG-GUIDE.md)**。

## 特性

- **场景问答引导**：产品系列 → 业务类型 → 协议 → 容器平台，自动带出全部推荐值，逐项可覆盖
- **四级产物实时预览**：安装 values / 存储后端 / StorageClass / PVC，下载或一键复制
- **三级防错**：表单实时校验（配置 DSL 驱动）→ 跨文件一致性自动保持 → 结果页部署自检清单
- **页面与配置完全分离**：所有字段/规则/家族矩阵/平台预设/防错清单/双语文案均为 `public/config/` 下的 YAML 数据，加配置无需改代码、无需重新构建（运行时加载，刷新即生效）
- **中英双语**、localStorage 自动保存进度

## 快速开始

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm test           # 36 个测试：条件 DSL / 渲染器 / golden 全链路 / 内嵌快照 / 组件冒烟
npm run build      # 产出单文件 dist/index.html（自包含，双击即可打开）
```

部署：把 `dist/` 整体拷贝到任意静态服务器（`base: './'`，可挂任意子路径，如随 css-docs 文档站放在 `/css-docs/wizard/`）。

### 两种打开方式都支持

| 方式 | 配置来源 | 改配置是否需重新构建 |
|------|---------|-------------------|
| **双击 `dist/index.html`**（file://） | 构建时内嵌快照 | 需要（重新 `npm run build`） |
| **HTTP 静态服务**（含文档站部署） | 运行时加载 `config/` 目录 | **不需要**（改 YAML 刷新即生效） |

构建时 `scripts/embed-config.mjs` 会把 `public/config/` 打成内嵌快照，运行时会优先 fetch `config/`，失败（file:// 或服务器缺目录）自动回退快照并给出控制台警告。

## 配置数据（加配置不改代码）

所有配置位于 `public/config/`，页面运行时加载：

| 文件 | 内容 | 新增示例 |
|------|------|---------|
| `index.yaml` | 版本 + 流程定义（加产物类型=加步骤+加模板） | 新增"静态 PV"产物 |
| `fields.yaml` | 字段目录：类型/条件/校验/分级/双语 label | 新增一个参数（协议=xxx 时显示） |
| `families.yaml` | 产品系列 × 业务类型 × 协议矩阵 | 新增产品系列/协议 |
| `helm.yaml` | 容器平台预设（Tanzu/CCE 差异等） | 新增平台 |
| `pitfalls.yaml` | 部署自检清单 | 新增防错提示 |
| `templates/` | 产物模板（`{{field}}` / `{{#if}}` / `{{#each}}`）与命令模板 | 改输出结构 |
| `i18n/*.yaml` | 界面文案（字段 label 就近写在字段定义里） | 新增 UI 文案 |

**保障机制**：配置文件加载时经 JSON Schema 校验 + 钩子/模板引用完整性检查，配置错误会以可读信息提示而不是白屏；`npm test` 的 golden 测试用真实配置跑全链路渲染比对，加配置后跑一次即可确认输出没被改坏。

## 目录结构

```
public/config/          # 全部配置数据（运行时加载）
src/
  engine/               # 渲染引擎（条件 DSL / 模板 / 引号 / 校验 / 配置加载）
  hooks/index.js        # 代码钩子注册表（Q6=B 的逃生门）
  store.js              # 全局状态 + localStorage + 场景级联
  components/           # 场景问答 / 步骤表单 / 结果页
tests/                  # vitest：conditions / renderer / golden
docs/DESIGN.md          # 设计文档（决策树 + schema 参考 + 维护指南）
```

## 适配范围

- 锁定华为 CSI **v4.12.0**（当前文档版本），`index.yaml` 预留 `version` 字段
- 家族数据：闪存存储（Dorado/V5/V6+）、海量存储 Pacific/FusionStorage、OceanDisk 块服务；A600/A800 与 DME（DataTurbo）待补
- 静态 PV 生成：v2
