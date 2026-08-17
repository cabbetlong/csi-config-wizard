// @vitest-environment jsdom
// 组件级冒烟测试：真实挂载 App，走完 场景 → 安装 流程，断言表单与预览有内容。
// 复现问题：场景选择完成后点击"进入向导"，后续页面均为空。
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'

const CONFIG_DIR = path.join(process.cwd(), 'public/config')

function fileResponse(file) {
  const full = path.join(CONFIG_DIR, file)
  if (!fs.existsSync(full)) return { ok: false, status: 404, text: async () => '' }
  return { ok: true, status: 200, text: async () => fs.readFileSync(full, 'utf8') }
}

beforeEach(() => {
  // 清掉上个用例持久化的状态（协议联动等会写入 localStorage）
  if (typeof localStorage !== 'undefined') localStorage.clear()
  global.fetch = vi.fn(async (url) => {
    const u = String(url)
    if (u.includes('/config/')) {
      const file = u.split('/config/')[1]
      return fileResponse(file)
    }
    return fileResponse(u.replace(/^\.\/?/, ''))
  })
})

describe('App 端到端（组件级）', () => {
  it('场景页渲染 → 点击进入向导 → Step1（CSI 安装）表单与预览有内容', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))

    // 场景页
    expect(wrapper.text()).toContain('配置场景')
    expect(wrapper.text()).toContain('闪存存储')

    // 点击"进入向导"
    const btns = wrapper.findAll('button')
    const enter = btns.find((b) => b.text().includes('进入向导'))
    expect(enter).toBeTruthy()
    await enter.trigger('click')
    await flushPromises()

    // Step1：CSI 安装 —— 表单字段 + 预览
    const html = wrapper.html()
    expect(wrapper.text()).toContain('CSI Driver 名称')
    expect(wrapper.text()).toContain('csi.huawei.com')
    expect(html).toContain('controllerCount: 1')
    expect(html).toContain('kubeletConfigDir')
  })

  it('错误延迟显示：进入后端步骤不直接红错，点下一步后才提示必填', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))

    // 场景 → Step1 → Step2（存储后端）
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()

    // 默认后端已预置且名称默认为 backend-1
    expect(wrapper.findAll('button.chip').length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain('backend-1')

    // url 必填且为空，但尚未触碰 → 不应显示错误
    expect(wrapper.find('.err-summary').exists()).toBe(false)
    expect(wrapper.find('.err').exists()).toBe(false)

    // 点击"下一步" → 展开该步错误
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    expect(wrapper.find('.err-summary').exists()).toBe(true)
    expect(wrapper.text()).toContain('必填')
  })

  it('协议双向联动：后端步骤默认选中场景协议，修改后同步回场景', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))

    // 场景 → Step1 → Step2（存储后端）
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()

    // 后端步骤的协议下拉存在，且默认选中场景中的协议（iscsi）
    const protoField = wrapper.findAll('.field').find((f) => f.text().includes('协议'))
    expect(protoField).toBeTruthy()
    expect(protoField.find('select').element.value).toBe('iscsi')

    // 修改为 fc → 联动：portals 字段消失（fc 协议禁止 portals）
    await protoField.find('select').setValue('fc')
    await flushPromises()
    expect(wrapper.findAll('.field').find((f) => f.text().includes('Portal 地址'))).toBeFalsy()

    // 联动：回到场景页，协议下拉已同步为 fc
    await wrapper.findAll('nav .step')[0].trigger('click')
    await flushPromises()
    const scnProto = wrapper
      .findAll('.field')
      .find((f) => f.find('.field-label')?.text().includes('协议'))
    expect(scnProto.find('select').element.value).toBe('fc')
  })

  it('场景页直接点"结果"：有未校验字段时跳转到第一个出错步骤并展开错误', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))

    // 场景页直接点击步骤条最后的"结果"
    const navSteps = wrapper.findAll('nav .step')
    await navSteps[navSteps.length - 1].trigger('click')
    await flushPromises()

    // 后端（首个有错步骤）url 必填为空 → 被拦截并跳转到该步
    expect(wrapper.text()).toContain('后端名称')
    expect(wrapper.find('.err-summary').exists()).toBe(true)
    // 提示 toast 出现
    expect(wrapper.text()).toContain('未通过校验')
  })

  it('必填高级参数自动提升到基础区（DME 的 storageDeviceSN）', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))

    // 场景页选择 DME 家族
    const famSelect = wrapper
      .findAll('.field')
      .find((f) => f.find('.field-label')?.text().includes('产品系列'))
      .find('select')
    await famSelect.setValue('dme')
    await flushPromises()

    // 进入向导 → Step1 → Step2（存储后端）
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()

    // storageDeviceSN（DME 必填）出现在基础区，且不在"高级选项"折叠区里
    expect(wrapper.text()).toContain('存储设备序列号')
    const adv = wrapper.find('.advanced')
    if (adv.exists()) {
      expect(adv.html()).not.toContain('存储设备序列号')
    }
  })

  it('步进导航：默认后端已预置，走完四步到达结果页', async () => {
    const wrapper = mount(App)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 30))

    // 场景 → Step1
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    // Step1 → Step2（存储后端）
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('后端名称')
    // 默认后端已预置（无需点击"添加后端"）
    expect(wrapper.findAll('button.chip').length).toBeGreaterThanOrEqual(1)

    // 填必填项：存储管理地址（url）
    const urlField = wrapper.findAll('.field').find((f) => f.text().includes('存储管理地址'))
    await urlField.find('input').setValue('https://192.168.1.10:8088')
    await urlField.find('input').trigger('blur')
    await flushPromises()

    // 给默认后端配置一个存储池（列表编辑器：加一行 → 输入）
    const poolField = wrapper.findAll('.field').find((f) => f.text().includes('存储池'))
    expect(poolField).toBeTruthy()
    await poolField.find('button').trigger('click') // 添加行
    await flushPromises()
    const poolInput = poolField.find('input')
    await poolInput.setValue('Pool001')
    await flushPromises()

    // iSCSI 协议下 portals 必填：加一行
    const portalField = wrapper.findAll('.field').find((f) => f.text().includes('Portal 地址'))
    expect(portalField).toBeTruthy()
    await portalField.find('button').trigger('click')
    await flushPromises()
    await portalField.find('input').setValue('10.0.0.1')
    await flushPromises()

    // Step2 → Step3（存储类）：存储池应为下拉框且选项来自所选后端
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('存储类名称')
    const poolSelect = wrapper
      .findAll('.field')
      .find((f) => f.text().includes('存储池'))
      .find('select')
    expect(poolSelect).toBeTruthy()
    expect(poolSelect.text()).toContain('Pool001')

    // Step3 → Step4（PVC）
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('PVC 名称')
    // Step4 → 结果页
    await wrapper.find('button.primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('部署结果')
    expect(wrapper.text()).toContain('helm-values.yaml')
  })
})
