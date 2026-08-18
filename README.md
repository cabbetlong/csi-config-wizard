# 华为 CSI 配置向导（csi-config-wizard）

引导客户逐步生成华为 CSI 部署所需的全部 YAML：`helm-values.yaml` → `backend.yaml`（oceanctl）→ `storageclass.yaml` → `pvc.yaml`，解决"步骤多、配置繁杂、易出错"的痛点。

- 设计文档：[docs/DESIGN.md](docs/DESIGN.md)
- **配置维护手册（任意步骤修改/新增参数）**：[docs/CONFIG-GUIDE.md](docs/CONFIG-GUIDE.md)
- 仓库：https://github.com/cabbetlong/csi-config-wizard（PRIVATE）

## 特性

- **场景问答引导**：产品系列 → 业务类型 → 协议 → 容器平台，自动带出全部推荐值，逐项可覆盖；**协议双向联动**（后端步骤修改协议会同步回场景与所有后端）
- **五大家庭 × 全量参数**：闪存 Dorado/V5/V6+、闪存 A600/A800、DME 互联、海量 Pacific/FusionStorage、OceanDisk；协议取值与官方文档一致（roce-nvme / tcp-nvme / dtfs / fc-nvme / nfs+ / dpc / scsi …），字段 60+
- **双活（HyperMetro）**：一键勾选自动创建对端后端（互填 metroBackend、配对 ID 双向同步），取消勾选级联移除
- **四级产物实时预览**：values / backend（多后端）/ StorageClass / PVC，下载或一键复制（结果页 YAML 折叠 + 悬浮复制 + 全部下载）
- **两级防错**：表单实时校验（配置 DSL 驱动；错误延迟显示，下一步/结果页守卫拦截并跳转修正）+ 跨文件一致性自动保持
- **values.yaml 与官方仓库逐行一致**：以 Huawei/eSDK_K8S_Plugin@v4.12.0 的 `helm/esdk/values.yaml` 为蓝本，注释、格式、默认值原样保留
- **页面与配置完全分离**：所有字段/规则/家族矩阵/平台预设/双语文案均为 `public/config/` 下的 YAML 数据，加配置无需改代码（仅少量文档化钩子例外）
- **部署流水线式界面**：墨蓝 + 华为红的设计语言，步骤条标注每个产物的应用工具（helm / oceanctl / kubectl），YAML 以“产物文件卡”呈现（文件名 + 实时校验状态 + 复制/下载）；中英双语、localStorage 自动保存、全键盘可达（focus-visible）

## 快速开始

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm test           # 43 个测试：条件 DSL / 渲染器 / golden 全链路 / 内嵌快照 / 组件冒烟
npm run build      # 产出单文件 dist/index.html（自包含，双击即可打开）
```

部署有两种方式：

- **静态拷贝**：把 `dist/` 整体拷贝到任意静态服务器（`base: './'`，可挂任意子路径，如随 css-docs 文档站放在 `/css-docs/wizard/`）
- **Docker（构建+部署一体）**：`docker compose up -d --build` → http://localhost:8080；支持挂载 config 卷热改配置（改 YAML 刷新即生效，无需重建镜像）。详见 [docs/DEPLOY-DOCKER.md](docs/DEPLOY-DOCKER.md)

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
| `index.yaml` | 版本 + 流程定义（含每步描述，加产物类型=加步骤+加模板） | 新增"静态 PV"产物 |
| `fields.yaml` | 字段目录：类型/条件/校验/分级/双语 label（必填参数自动提升到基础区） | 新增一个参数（协议=xxx 时显示） |
| `families.yaml` | 产品系列 × 业务类型 × 协议矩阵（5 家族全量） | 新增产品系列/协议 |
| `helm.yaml` | 容器平台预设（K8s/OpenShift/Tanzu/CCE 差异） | 新增平台 |
| `templates/` | 产物模板（`{{field}}` / `{{#if}}` / `{{#unless}}` / `{{#each}}`）与命令模板 | 改输出结构 |
| `i18n/*.yaml` | 界面文案（字段 label 就近写在字段定义里） | 新增 UI 文案 |

**保障机制**：配置文件加载时经 JSON Schema 校验 + 钩子/模板引用完整性检查，配置错误会以可读信息提示而不是白屏；`npm test` 的 golden 测试用真实配置跑全链路渲染比对，加配置后跑一次即可确认输出没被改坏。

## 目录结构

```
public/config/          # 全部配置数据（运行时加载）
src/
  engine/               # 渲染引擎（条件 DSL / 模板 / YAML 引号 / 校验 / 配置加载）
  hooks/index.js        # 代码钩子注册表（逃生门，未注册的钩子引用会报配置错误）
  store.js              # 全局状态 + localStorage + 场景级联 + 双活配对管理
  components/           # 场景问答 / 步骤表单 / 结果页
scripts/embed-config.mjs # 构建时生成配置内嵌快照（file:// 兜底）
tests/                  # vitest：conditions / renderer / golden / embedded / 组件冒烟
.pi/skills/csi-config-wizard/   # 配置维护技能（pi 自动发现，改配置时触发）
docs/DESIGN.md          # 设计文档（决策树 + schema 参考）
docs/CONFIG-GUIDE.md    # 配置维护手册（分步骤操作指南）
```

## 适配范围

- 锁定华为 CSI **v4.12.0**（当前文档版本），`index.yaml` 预留 `version` 字段
- 家族矩阵与参数对照 css-docs 当前文档逐页核实；字段 60+（backend 22 / SC 26 / helm 12 / PVC 4）
- 静态 PV 生成：v2
