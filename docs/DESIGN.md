# 华为 CSI 配置向导 — 设计文档

> 状态：共享理解已确认，进入实现。适配 CSI **v4.12.0**（当前文档版本）。

## 1. 目标

引导客户逐步生成华为 CSI 部署所需的全部 YAML 配置，解决"步骤多、配置繁杂、易出错"的痛点。

生成的四个产物（按部署顺序）：

| # | 产物 | 创建方式 |
|---|------|---------|
| 1 | `helm-values.yaml` | `helm install` 前放置于 `helm/esdk/values.yaml` |
| 2 | `backend-<name>.yaml`（每后端一个） | `oceanctl create backend -f <file> -i yaml`（凭据交互式输入） |
| 3 | `storageclass.yaml` | `kubectl apply -f storageclass.yaml` |
| 4 | `pvc.yaml` | `kubectl apply -f pvc.yaml` |

## 2. 关键事实（来自官方文档，设计依据）

- **backend 不是 kubectl CR**：官方流程是扁平的 oceanctl YAML + `oceanctl create backend`，创建时交互式输入账号密码（存 K8s Secret）。
- **StorageClass 走 kubectl**，`provisioner` 必须等于 Helm values 的 `csiDriver.driverName`（默认 `csi.huawei.com`）。
- **Helm 官方流程**：本地 chart（`helm install helm-huawei-csi ./ -n huawei-csi --create-namespace`），**从不使用 `--set`**，一切配置改完整 values.yaml。安装前需 `kubectl apply -f ./crds/backend/`（可选 snapshot CRD）。
- **协议→portals 规则**：iscsi/nvme-roce/nvme-tcp 必填 portals；nfs/nfs+ 需要（NFS 仅一个）；fc/fc-nvme/dpc 禁止；scsi 为字典列表。
- **家族→死规则**：`storage` 字段值（oceanstor-san / oceanstor-nas / oceanstor-dtree / fusionstorage-* / oceandisk-san）、`volumeType`（lun/fs/dtree）随产品系列+业务类型固定。
- **平台差异**：Tanzu 需 `kubeletConfigDir=/var/vcap/data/kubelet`；CCE 需 `/mnt/paas/kubernetes/kubelet` + `driverName=csi.oceanstor.com` + helm package 上传控制台；OpenShift 需前置 `oc create -f helm_scc.yaml`。
- 文档站为 Hugo + Docsy，中英双语，当前版本 v4.12.0。

## 3. 已确认决策（18 项）

### 形态与分发
1. **静态单页** HTML，Vue + Vite 构建，无后端。
2. 配置为**独立 YAML 数据文件，运行时加载**——加配置零构建、刷新即生效。
3. 产出纯静态目录，随 css-docs 文档站（Hugo）部署（`base: './'` 相对路径，可挂任意子路径）。
4. 配置按主题多文件（见 §4 文件树）。
5. **中英双语**：字段 label 就近写在字段定义（`label_zh`/`label_en`），界面文案走 `i18n/*.yaml`。

### 流程
6. 单向导四步（安装 → 后端 → 存储类 → PVC），不区分角色。
7. 首页"配置场景"快速问答，级联顺序：**① 产品系列（家族）→ ② 业务类型（块/文件/dtree）→ ③ 协议 → ④ 容器平台**；推荐值全部可覆盖（Q4=B 语义）。
8. 全局响应式状态 + **localStorage 自动保存**，四个产物是状态的实时视图，跨文件联动自动保持。
9. Step2 支持**多个后端**；Step3 后端下拉列出已建后端。
10. 高级参数（ALUA、maxClientThreads、HyperMetro、LDAP、QoS…）字段全集进配置，UI 折叠在"高级选项"；**静态 PV 生成延后到 v2**。

### 易维护内核
11. 字段定义是表单与输出**共用的唯一规则源**：`visible_when` / `required_when` / `validate` 一套 DSL（`eq/neq/in/not-in` + `{all}/{any}` 复合，可引用跨步骤 `{state: X}`）。
12. 产物模板带 `{{field}}` / `{{#if}}` / `{{#each}}` 占位符，模板≈最终 YAML 形状；条件表达式与字段规则同一语法。
13. 数据为主 + 少量**代码钩子**（`src/hooks/index.js` 注册有限钩子 id；引用未注册 id → 启动报配置错误）。
14. 配置自校验（JSON Schema）+ golden 渲染测试——加配置跑 `npm test` 验证。
15. 锁 CSI v4.12.0；`index.yaml` 预留 `version` / `schemaVersion` 字段。

### 防错（三级）
16. 表单内实时校验（规则全在配置 DSL）。
17. 生成时跨文件自检：`provisioner = driverName`、`SC.backend ∈ 已建后端`、`PVC.storageClassName = SC 名`、backend namespace 与 helm namespace 一致。
18. 结果页部署自检清单（`pitfalls.yaml` 数据驱动）。

## 4. 配置文件树（Q10=A）

```
public/config/
  index.yaml            # 版本元信息 + 四步流程定义（加产物类型=加步骤+加模板，零代码）
  fields.yaml           # 字段目录：类型/条件/校验/分级（表单与模板共用规则源）
  families.yaml         # 产品系列 × 业务类型 × 协议矩阵
  helm.yaml             # Step1 平台预设 + values.yaml 参数目录
  pitfalls.yaml         # 部署自检清单（Q12③）
  templates/
    helm-values.yaml    # 完整 values.yaml（含官方默认值 + 向导字段占位符 + 注释）
    backend.yaml        # oceanctl 后端 YAML
    storageclass.yaml   # StorageClass
    pvc.yaml            # PVC
    commands/           # 每步命令模板（平台差异用 {{#if}}）
  i18n/zh.yaml  i18n/en.yaml
```

## 5. 字段 DSL（fields.yaml）

```yaml
fields:
  - id: backend.protocol          # 命名空间 = 产物.字段
    label_zh: 协议
    label_en: Protocol
    type: select                  # text|number|select|bool|list|key-value-list|json-text|textarea
    required: true
    options_from: family.protocols
    level: basic                  # basic=平铺 / advanced=折叠进"高级选项"
    validate: {pattern: "..."}    # 或 {min, max} / {enum: [...]}
    visible_when:  {field: backend.protocol, in: [iscsi, nvme-roce]}
    required_when: {field: backend.protocol, in: [iscsi]}
    default: 30
    placeholder_zh: ...
    help_zh: ...
    hook: validate-json           # 代码钩子 id（未注册 → 启动报错）
```

**条件表达式语法**（`visible_when`/`required_when`/模板 `{{#if}}` 共用）：
- `{field: "backend.protocol", op: v}`，op ∈ `eq|neq|in|not-in|exists`
- `{state: "platform", eq: "cce"}` 引用跨步骤全局状态
- 复合：`{all: [...]}` / `{any: [...]}` / `{not: {...}}`

## 6. 模板引擎

行级扫描，占位符规则：

| 形态 | 示例 | 渲染 |
|------|------|------|
| 整值占位符 | `name: "{{backend.name}}"` | 值按 YAML 安全引号重写（自动选引号风格） |
| 裸整值 | `controllerCount: {{helm.controllerCount}}` | 数字/布尔原样，字符串加引号 |
| 内嵌占位符 | `"{{helm.imageRepo}}/huawei-csi:4.12.0"` | 保持外层引号，转义值内 `"` `\` |
| 条件块 | `{{#if expr}} ... {{/if}}` | expr 为裸字段路径（真值检查）或内联 JSON 条件；标记行整体消失，内容行缩进原样保留 |
| 循环块 | `{{#each list}} ... {{/each}}` | 内用 `{{this}}` / `{{this.key}}`；空列表整体消失 |

条件块标记行本身不输出；内容行的缩进按模板原样写出（透明标记规则）。

## 7. 代码钩子注册表（Q6=B）

`src/hooks/index.js` 导出 `{ name: fn }` 映射。配置中 `hook: <id>` 引用；配置加载时校验所有引用均存在，否则报"配置错误"并停止加载。v1 钩子：
- `validate-json`：qos / advancedOptions 等 JSON 字符串字段的格式校验
- （预留）`validate-scsi-hosts` 等

## 8. 防错清单（pitfalls.yaml）

条目带 `artifact` + 可选 `condition` + 双语文案；结果页逐条判定 pass / fail / n/a。v1 条目（全部来自文档事实）：
- backend 命名：小写字母/数字/中划线，≤63，首字符为字母或数字
- backend namespace 必须等于 CSI 命名空间（默认 huawei-csi）
- fc / fc-nvme / dpc 协议不得填写 portals
- NFS 协议仅一个 portal
- SC `provisioner` 必须等于 Step1 的 driverName
- SC `volumeType` 由业务类型固定（lun/fs/dtree），不可随意改
- Dorado 不支持 `thick`
- 文件服务 SC 必须填 `authClient`
- ext4 上限 50Ti，更大容量用 xfs
- PV/PVC 容量单位必须为 `Gi`/`Ti` 结尾
- oceanctl 创建后端时交互式输入账号密码（不是 YAML 里写密码）
- CCE 平台走 helm package 上传控制台，不走 helm install
- OpenShift 需先 `oc create -f helm_scc.yaml`
- `driverName` 重装时必须保持一致，否则已有卷不可管理

## 9. 维护指南（加配置不改代码）

| 变更 | 操作 | 是否改代码 |
|------|------|-----------|
| 新增产品系列/协议组合 | families.yaml 加条目 | 否 |
| 新增字段/条件/校验 | fields.yaml 加字段定义；模板加占位符 | 否 |
| 新增场景推荐值 | 场景由家族矩阵+平台预设承载，改 families.yaml/helm.yaml | 否 |
| 新增防错条目 | pitfalls.yaml | 否 |
| 新增产物类型（如静态 PV） | index.yaml flow 加步骤 + 新模板 + fields.yaml 加字段组 | 否 |
| 新增钩子 | src/hooks/index.js 注册 | 是（有意为之的逃生门） |

**配置自校验**：所有配置文件经 JSON Schema 校验（`src/engine/schema/*.json`），配置错误在页面加载时即时报出。
**渲染测试**：`tests/golden/` 下放固定状态→期望 YAML，`npm test` 跑全链路比对。

## 10. v1 范围与数据缺口

- 家族数据：v1 覆盖 闪存（flash）、海量 Pacific/FusionStorage（pacific）、OceanDisk 块服务（oceandisk）三个系列；**A600/A800 与 DME（DataTurbo 协议）待补**（数据缺口，UI 不展示）。
- 高级字段：HyperMetro、LDAP、kerberos 系列、clone/restore、拓扑感知等已列入 schema，v1 配置数据仅填已验证部分，其余留待补。
- 静态 PV 生成：v2。
- 多语言：zh/en 全量。
