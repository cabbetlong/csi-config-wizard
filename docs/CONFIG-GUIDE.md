# 华为 CSI 配置向导 — 配置维护指南

> 目标读者：后续维护向导的工程师。
> 本文讲解**如何在不改代码的前提下，在任意步骤修改或新增参数**（对应需求"页面与配置分离，后续增加配置无需更改代码"）。
> 设计原理与决策树见 [DESIGN.md](DESIGN.md)。

---

## 0. 一句话原理

向导 = **渲染引擎（代码，几乎不动）** + **配置数据（`public/config/` 下的 YAML，日常维护对象）**。

- `fields.yaml` 的**字段定义**同时驱动三件事：**表单 UI、校验规则、条件显示**
- `templates/*.yaml` 的**产物模板**决定 YAML 输出的形状（`{{字段}}` / `{{#if}}` / `{{#each}}`）
- `families.yaml`（产品系列×业务类型×协议矩阵）、`helm.yaml`（平台预设）提供**场景选项**
- `i18n/*.yaml` + 字段里的 `label_zh/label_en` 提供**双语文案**

> 注：早期版本曾包含 `pitfalls.yaml`（部署自检清单）并在结果页展示一致性检查，已按需求移除（v0.2）；表单实时校验与跨文件一致性自动保持仍然生效。

**改参数 = 改 YAML 数据；只有遇到"现有机制表达不了的需求"才需要动代码**（见 §8.5）。

---

## 1. 配置生效方式（先读这个）

| 访问方式 | 配置来源 | 改配置后 |
|---|---|---|
| `npm run dev` / HTTP 部署（含文档站） | 运行时 fetch `config/` 目录 | **刷新页面即生效，无需构建** |
| 双击 `dist/index.html`（file://，`build:single` 产物） | 构建时内嵌快照（`scripts/embed-config.mjs` 生成） | 需重新 `npm run build:single` |

- 配置**加载失败**（缺文件/网络）→ 自动回退内嵌快照 + 浏览器控制台警告
- 配置**内容错误**（schema 校验失败 / 引用了未定义的字段或钩子）→ 页面显示"配置加载失败"并给出具体错误，**不静默回退**（这是真实配置问题，必须暴露）

---

## 2. 文件地图

| 文件 | 内容 | 典型修改场景 |
|---|---|---|
| `public/config/index.yaml` | 版本 + 四步流程定义 | 新增产物类型（如静态 PV） |
| `public/config/fields.yaml` | 全部字段定义（表单+校验+条件+双语） | **增删改任意参数** |
| `public/config/families.yaml` | 产品系列 × 业务类型 × 协议矩阵 | 新增系列/业务类型/协议 |
| `public/config/helm.yaml` | 容器平台预设 | 新增平台、改平台差异值 |
| ~~`public/config/pitfalls.yaml`~~ | ~~部署自检清单~~（已移除，v0.2） | — |
| `public/config/templates/*.yaml` | 4 个产物模板 | 改 YAML 输出结构 |
| `public/config/templates/commands/*.yaml` | 每步部署命令模板 | 改命令、按平台区分命令 |
| `public/config/i18n/{zh,en}.yaml` | UI 通用文案 | 按钮/标题/错误提示 |
| `src/hooks/index.js` | 代码钩子注册表 | **唯一需要改代码的地方** |

---

## 3. 字段定义（fields.yaml）完整说明

每个字段是 `fields` 数组中的一个对象，`id` 命名规则：**`<产物>.<名称>`**，产物 ∈ `scenario | helm | backend | sc | pvc`。

```yaml
fields:
  - id: sc.allocType              # 必填。产物.名称，模板里 {{sc.allocType}} 与之对应
    label_zh: 分配类型             # 必填。中文 label
    label_en: Alloc Type          # 必填。英文 label
    type: select                  # 必填。字段类型（见下表）
    level: basic                  # 可选。basic=平铺展示，advanced=折叠进"高级选项"（默认 basic）
                                  #   ⚠ 必填参数自动提升：advanced 字段若 required 或
                                  #   required_when 当前为真，会被引擎提升到基础区展示（UX 规则），
                                  #   所以必填参数写在 advanced 里也没关系——不要在高级区藏必填项
    default: thin                 # 可选。默认值（仅在字段当前可见时应用）
    required: true                # 可选。无条件必填
    options: [thin, thick]        # select 用。静态选项列表
    options_from: family.protocols # select 用。动态选项来源（见下表）
    item: {type: text, validate: {pattern: "^..."}}   # list 用。列表项的类型与校验
    validate:                     # 可选。校验规则
      pattern: "^[a-z0-9.\\-]+$"  #   正则（注意 YAML 中写两个反斜杠）
      min: 1                      #   数字下限
      max: 30                     #   数字上限
      enum: [a, b]                #   枚举白名单
    visible_when: {...}           # 可选。条件显示（DSL 见 §4）
    required_when: {...}          # 可选。条件必填（DSL 见 §4）
    hook: validate-json           # 可选。代码钩子 id（见 §8.5）
    placeholder_zh: ...           # 可选。输入提示
    placeholder_en: ...
    help_zh: ...                  # 可选。字段下方帮助文案
    help_en: ...
```

### 3.1 type 可选值

| type | 渲染 | 说明 |
|---|---|---|
| `text` | 单行输入 | 最常用 |
| `textarea` | 多行输入 | 长文本 |
| `json-text` | 多行输入 + 钩子校验 | 配合 `hook: validate-json` |
| `number` | 数字输入 | 配合 `validate.min/max` |
| `select` | 下拉框 | 配合 `options` 或 `options_from` |
| `bool` | 复选框 | 值 true/false |
| `list` | 动态列表（可增删行） | 每项为字符串，配合 `item` |
| `key-value-list` | 键值对列表 | 每项 `{key, value}`，如 SCSI 的 portals |
| `select-family` / `select-service` / `select-protocol` / `select-platform` | 场景四连下拉 | **只用于 scenario 步骤**，选项来自 families.yaml/helm.yaml |

### 3.2 options_from 可选值

| 值 | 选项来源 |
|---|---|
| `family.protocols` | 当前"产品系列+业务类型"的可用协议 |
| `state.backends` | 已创建的后端名称列表（Step3"关联后端"用） |
| `state.backendPools` | 所选后端的存储池列表（Step3"存储池"用） |

> 需要**新的选项来源**（比如"已创建的 PVC 列表"）→ 需要改代码（`FieldInput.vue` 的 `resolveOptions` + `schemas.js` 枚举），见 §8.5。

---

## 4. 条件 DSL 参考（visible_when / required_when / 模板 {{#if}} 共用）

```yaml
visible_when: {field: backend.protocol, in: [iscsi, nvme-roce]}   # 字段值判断
visible_when: {state: serviceType, eq: block}                     # 跨步骤状态判断
visible_when: {field: backend.portals, exists: true}              # 存在性（非空/非undefined）
visible_when: {field: backend.portals, empty: true}               # 为空
visible_when: {all: [{field: A, eq: x}, {state: B, neq: y}]}      # 全部满足
visible_when: {any: [{field: A, eq: x}, {state: B, eq: y}]}       # 任一满足
visible_when: {not: {field: A, eq: x}}                            # 取反
visible_when: "backend.portals"                                   # 字符串简写 = 真值检查
```

- 操作符：`eq` `neq` `in` `not-in` `exists` `empty`
- 两种写法等价：`{field: X, in: [...]}`（简写）与 `{field: X, op: "in", value: [...]}`（显式）
- `field` 引用**字段值**（走 fields map），`state` 引用**派生状态**（见 §6）

---

## 5. 模板语法参考（templates/*.yaml）

行级引擎，标记行整体消失，内容行缩进原样保留（透明标记）。

| 形态 | 示例 | 行为 |
|---|---|---|
| 整值占位符 | `name: "{{backend.name}}"` | 值用 YAML 安全引号**自动重写**（含 `:` `{` 等自动加引号；纯数字/布尔原样） |
| 裸整值 | `controllerCount: {{helm.controllerCount}}` | 同上（用于数字/布尔） |
| 内嵌占位符 | `"{{state.imagePrefix}}huawei-csi:4.12.0"` | 保持外层引号，只转义值内 `"` `\` |
| 条件块 | `{{#if backend.portals}} ... {{/if}}` | 条件为假整块不输出；条件可为字段路径（真值检查）或内联 JSON |
| 循环块 | `{{#each backend.pools}}` + `- "{{this}}"` + `{{/each}}` | 空列表整块不输出；内用 `{{this}}` / `{{this.key}}` / `{{index}}` |

**规则**：
- 占位符 token 必须能在 `fields.yaml` 中找到（`{{sc.xxx}}` 必须有 `id: sc.xxx` 的字段），否则**加载时报错**（防手滑）
- 标记行（`{{#if}}`/`{{#each}}`/`{{/if}}`/`{{/each}}`）必须独占一行
- 引号规则：**不要**自己写 `qos: '{{sc.qos}}'` 这种给占位符包引号，直接用 `qos: {{sc.qos}}`（引擎会选正确的引号风格）

---

## 6. 状态与派生值（模板和条件里可引用）

| 引用 | 含义 |
|---|---|
| `{{state.platform}}` | 场景选择的容器平台 |
| `{{state.serviceType}}` / `{{state.familyId}}` / `{{state.protocol}}` | 场景选择 |
| `{{state.backends}}` | 已建后端名称数组 |
| `{{state.scName}}` / `{{state.scBackend}}` | Step3 的名称 / 所选后端 |
| `{{state.driverName}}` | Step1 的 driverName（跨产物一致性：SC provisioner 用它） |
| `{{state.namespace}}` | Step1 的命名空间 |
| `{{state.imagePrefix}}` | 镜像仓库前缀（含尾 `/`，空为 `""`） |
| `{{state.backendName}}` | 当前后端名称 |
| `{{state.volumeType}}` / `{{state.storage}}` | 当前业务类型的 volumeType / storage 值 |
| `{{family.storage}}` / `{{family.volumeType}}` / `{{family.protocols}}` | 当前家族×业务类型的派生值 |
| `{{this}}` / `{{this.key}}` | {{#each}} 循环项 |

---

## 7. 分步骤操作手册

### 7.0 新增参数的标准五步流程（适用于任何步骤）

1. **`fields.yaml` 加字段定义**（id 以产物前缀开头）
2. **`templates/<产物>.yaml` 加占位符**（普通参数：直接加一行；条件参数：包 `{{#if}}`）
3. （需要时）加 `visible_when` / `required_when` / `validate` / `default` / `options` / `options_from`
4. （需要时）在 `i18n/{zh,en}.yaml` 或字段的 `label_zh/en` 里补文案
5. **验证**：`npm test` + `npm run dev` 人工核对（见 §9）

> 新增字段若不带 `label_zh`/`label_en`，schema 校验直接报错（必填），不会留到线上才发现。

---

### 7.1 场景步骤（产品系列 → 业务类型 → 协议 → 平台）

场景本身由 `families.yaml` + `helm.yaml` 驱动，**一般不需要加字段**。

**给某个系列新增协议**（例：Pacific 块服务新增 fc）：

```yaml
# families.yaml
  - id: pacific
    serviceTypes:
      block:
        protocols: [iscsi, scsi]   # → [iscsi, scsi, fc]
```

保存刷新即可：场景步骤的协议下拉、Step2 的协议下拉自动出现 fc。

**给协议补中文/英文名**（新协议出现在下拉里时）：

```yaml
# i18n/zh.yaml
protocol.fc: FC          # 若未配置则下拉显示原始 id（如 "fc"），所以新协议务必补这条
```

**新增平台**（例：新增"私有云 PKS"）：

```yaml
# helm.yaml
platforms:
  - {id: pks, label_zh: PKS, label_en: PKS, presets: {kubeletConfigDir: /var/lib/kubelet, driverName: csi.pks.com}}
# i18n/zh.yaml / en.yaml
platform.pks: PKS
```

`presets` 里的键必须对应 `helm.*` 字段（kubeletConfigDir / driverName / ...），选择平台时自动覆盖这些字段。

---

### 7.2 Step1 CSI 安装（`helm.*` 字段）

**改默认值**（例：把 Controller 副本数默认从 1 改为 2）：

```yaml
# fields.yaml
  - id: helm.controllerCount
    default: 2      # 原来是 1
```

**新增一个参数**（例：新增"Controller 资源 requests"高级参数，输出到 values.yaml）：

```yaml
# fields.yaml —— 加字段（Step1 产物前缀 helm.）
  - id: helm.controllerResources
    label_zh: Controller 资源限制
    label_en: Controller Resources
    type: text
    level: advanced
    placeholder_zh: 'cpu: 100m, memory: 256Mi'
```

```yaml
# templates/helm-values.yaml —— 加占位符（输出到 controller 段下）
controller:
  controllerCount: {{helm.controllerCount}}
  {{#if helm.controllerResources}}
  resources:
    requests: "{{helm.controllerResources}}"
  {{/if}}
```

> 模板里 `{{helm.controllerResources}}` 与字段 `id: helm.controllerResources` 必须**逐字一致**，否则加载报错。

---

### 7.3 Step2 存储后端（`backend.*` 字段，支持多后端）

**新增一个后端级参数**（例：新增"存储 vStore 名称"高级参数）：

```yaml
# fields.yaml
  - id: backend.vstoreName
    label_zh: vStore 名称
    label_en: vStore Name
    type: text
    level: advanced
    visible_when: {state: serviceType, in: [file, dtree]}   # 只对文件类显示
```

```yaml
# templates/backend.yaml
  {{#if backend.vstoreName}}
  vstoreName: "{{backend.vstoreName}}"
  {{/if}}
```

**让新字段只在某协议下显示**（例：仅 SCSI 显示"主机名映射"）：

```yaml
visible_when: {field: backend.protocol, eq: scsi}
```

**注意**：新后端字段的 `default` 只会在**新建后端时**按当前可见性应用；对已存在的后端不追溯。改默认值后建议清一下浏览器 localStorage 再验证。

**双活（HyperMetro）**：`backend.hyperMetro` 复选框勾选后自动创建对端后端（`<名>-metro`），两端互填 `metroBackend`、配对 ID（`metrovStorePairID`）双向同步（代码行为，非配置数据）；取消勾选或删除一侧会级联移除对端。配对 ID 必填（`required_when: {field: backend.hyperMetro, eq: true}`）。

---

### 7.4 Step3 存储类（`sc.*` 字段）

**新增文件服务参数**（例：新增 `reservedSnapshotSpaceRatio`）：

```yaml
# fields.yaml
  - id: sc.reservedSnapshotSpaceRatio
    label_zh: 快照空间预留比例
    label_en: Reserved Snapshot Space Ratio
    type: text
    level: advanced
    visible_when: {state: serviceType, in: [file, dtree]}
    help_zh: 文件服务专用；值如 "10"
```

```yaml
# templates/storageclass.yaml —— parameters 段内
  {{#if sc.reservedSnapshotSpaceRatio}}
  reservedSnapshotSpaceRatio: "{{sc.reservedSnapshotSpaceRatio}}"
  {{/if}}
```

**给下拉加选项**：静态列表用 `options`，动态来源用 `options_from`（后端列表 / 存储池列表已内置）。

**联动提醒**：切换"关联后端"会自动重置"存储池"（池属于旧后端，代码行为）。若新参数也有类似的"跟随关系"，要么接受手动重置，要么提需求加代码钩子。

---

### 7.5 Step4 PVC（`pvc.*` 字段）

**新增参数**（例：新增"标签"键值对，输出到 metadata.labels）：

```yaml
# fields.yaml
  - id: pvc.labels
    label_zh: 标签
    label_en: Labels
    type: key-value-list
    level: advanced
```

```yaml
# templates/pvc.yaml
  {{#if pvc.labels}}
  labels:
  {{#each pvc.labels}}
    "{{this.key}}": "{{this.value}}"
  {{/each}}
  {{/if}}
```

> `{{#each}}` 里用 `{{this.key}}` / `{{this.value}}` 取键值对的两列（key-value-list 类型）。

---

## 8. 其他可维护项

### 8.1 改 YAML 输出结构
直接编辑 `templates/` 下对应模板。规则见 §5。改完跑 `npm test`（golden 测试会告诉你输出是否被改坏——如果是有意改动，同步更新 `tests/golden.test.js` 的期望值）。

### 8.2 ~~新增防错清单条目（pitfalls.yaml）~~（已移除，v0.2）

> 部署自检清单与结果页一致性检查已按需求移除；如需恢复，重新创建 `public/config/pitfalls.yaml`，并在 `configLoader.js` 的 `CONFIG_FILES` 与 `schemas.js` 中登记即可。

### 8.3 改部署命令（commands/*.yaml）

每步一个 YAML 列表，每条含 `when`（平台条件）、`text_zh/en`、`code`（可含 `{{...}}` 占位符）。按平台区分命令的例子：

```yaml
commands:
  - when: {state: platform, neq: cce}
    text_zh: 常规安装
    text_en: Standard install
    code: |
      helm install helm-huawei-csi ./ -n {{helm.namespace}} --create-namespace
  - when: {state: platform, eq: cce}
    text_zh: CCE 打包上传
    text_en: CCE package-upload
    code: |
      helm package ./esdk/ -d ./
```

### 8.4 多语言文案
- 字段 label/help/placeholder：直接写字段定义里的 `label_zh`/`label_en`/`help_*`/`placeholder_*`
- UI 通用文案（按钮/标题/错误）：`i18n/zh.yaml` 与 `i18n/en.yaml` 成对维护，缺任一侧自动回退另一侧
- 协议/平台/业务类型的名称：`i18n` 里的 `protocol.*` / `platform.*` / `serviceType.*` 键

### 8.5 需要改代码的情形（仅这些）

| 需求 | 改动点 |
|---|---|
| 新字段类型 | `FieldInput.vue` 增加渲染分支 + `schemas.js` type 枚举 |
| 新的 `options_from` 选项来源 | `FieldInput.vue` 的 `resolveOptions` + `schemas.js` 枚举 |
| 新校验逻辑（非正则/范围） | `src/hooks/index.js` 注册新钩子，字段里 `hook: <id>` 引用 |
| 新的跨字段联动/重置逻辑 | `src/store.js` 的 `setField`（如 sc.backend→sc.pool 重置） |
| 新产物类型（如静态 PV） | `index.yaml` flow 加步骤 + 新模板 + fields.yaml 字段组 |

> 钩子约定：返回 `null` 表示通过，返回字符串表示错误消息的 i18n key。配置引用了**未注册**的钩子 → 加载报错（防写错）。

---

## 9. 验证

```bash
npm test        # 前置会自动重新生成内嵌快照（pretest）
```

测试覆盖：
- **schema 校验**：每个配置文件是否符合 JSON Schema（`buildConfig` 阶段）
- **引用完整性**：模板占位符必须能在 fields.yaml 找到；钩子必须已注册
- **golden 渲染**（`tests/golden.test.js`）：真实配置 + 固定输入 → 期望 YAML 全量比对
- **内嵌快照一致性**（`tests/embedded.test.js`）：file:// 兜底路径渲染结果与运行时路径一致
- **组件冒烟**（`tests/app.smoke.test.js`）：真实挂载 App 走完四步流程

**维护者改动配置后建议**：
1. `npm test` 全绿
2. `npm run dev` 人工走一遍受影响步骤
3. 若是有意改变输出，同步更新 `tests/golden.test.js` 里的期望字符串（或在文件头部注释标明）

---

## 10. 常见错误与陷阱

| 错误 | 现象 | 解决 |
|---|---|---|
| 字段缺 `label_zh`/`label_en` | 页面报"配置加载失败" | schema 必填，补上 |
| 模板引用了不存在的字段 | 加载报错"模板 xx 引用了未定义的字段" | 检查 token 与字段 id 逐字一致 |
| `hook:` 写错 id | 加载报错"引用了未注册的代码钩子" | 先注册钩子或用已有 `validate-json` |
| YAML 值里有 `: `（冒号+空格）| YAML 解析报"bad indentation" | 整个值加引号 |
| YAML 值以 `:` 结尾 | 同上 | 去掉行尾冒号或加引号 |
| 给占位符手写引号 `qos: '{{sc.qos}}'` | 引号重复/内容损坏 | 用裸占位符 `qos: {{sc.qos}}`，引擎自动选引号 |
| 新字段有 default 但没生效 | 已存在的后端/状态不追溯 | default 只在初始化/可见性切换时应用；清 localStorage 重试 |
| 新协议下拉显示原始 id | i18n 缺 `protocol.<id>` | 补文案 |
| 改了配置双击 dist 打开没变化 | file:// 用构建时快照 | 重新 `npm run build:single` |

---

## 附：当前字段速查（v0.1）

| 产物 | 字段 |
|---|---|
| scenario | familyId, serviceType, protocol, platform |
| helm | driverName, namespace, kubeletConfigDir, controllerCount, snapshotEnabled, volumeUseMultipath, scsiMultipathType, nvmeMultipathType, logLevel, maxVolumesPerNode, connectorThreads, imagePullSecrets（模板与官方 helm/esdk/values.yaml 格式、注释逐行一致） |
| backend | 基础：name, url, pools, protocol, portals, scsiHosts；高级：alua, maxClientThreads, authenticationMode, parentname（dtree）, nfsAutoAuthClient/nfsAutoAuthClientCIDRs（dtree NFS）, vstoreName（V5）, accountName（Pacific NAS/dtree）, metrovStorePairID/metroBackend（NAS 双活）, supportedTopologies, storageDeviceSN（DME 必填） |
| sc | 基础：name, backend, pool, allocType, fsType, authClient；高级：mountOptions, reclaimPolicy, allowVolumeExpansion, qos, hyperMetro, description, restoreMode, cloneSpeed, applicationType, fsPermission, disableVerifyCapacity, volumeName, metroPairSyncSpeed（块）；waitForSplit, rootSquash, allSquash, snapshotDirectoryVisibility, reservedSnapshotSpaceRatio, advancedOptions（文件） |
| pvc | name, accessModes, volumeMode, storage |

> 协议取值（与官方文档一致）：fc / iscsi / **roce-nvme**（NVMe over RoCE，roce 已弃用）/ fc-nvme / **tcp-nvme** / nfs / nfs+ / dpc / scsi / **dtfs**（DataTurbo）。
