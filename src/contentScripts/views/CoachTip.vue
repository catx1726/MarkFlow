<!-- src/contentScripts/views/CoachTip.vue -->
<script setup lang="ts">
import { nextTick, onUnmounted, reactive, ref } from 'vue'
import { getMaxZIndex } from '~/logic/dom'
import { computeTooltipPosition } from '~/logic/tooltipPosition'
import type { AnchorRect } from '~/logic/tooltipPosition'
import { coachKeyLabel, isMacPlatform } from '~/logic/coachTip'
import { t } from '~/logic/i18n'

/**
 * 首次引导浮层（Coach Tip）：一次性提示「按住 Alt 划词即可标记」核心手势。
 * Spec: docs/superpowers/specs/2026-09-11-coach-tip-design.md
 *
 * 纯提示零交互：pointer-events-none，点击穿透宿主页。
 * 消失三通道（组件自管理，宿主零侵入）：6s 超时 / 任意 mousedown / 页面滚动。
 * 两阶段渲染：先隐藏挂载测量，定位完成后才可见（同 Tooltip 模式，防闪跳）。
 */
const DISMISS_TIMEOUT_MS = 6000

const visible = ref(false)
const isPositioned = ref(false)
const position = reactive({ x: 0, y: 0 })
const tipRef = ref<HTMLElement | null>(null)
const zIndex = ref(0)

const keyLabel = coachKeyLabel(isMacPlatform(navigator.platform))

let dismissTimer = 0

async function show(anchorRect: AnchorRect) {
  // 重复 show()（未先 hide）时清掉旧定时器，避免孤儿定时器在原 6s 截止点提前隐藏重新显示的提示
  clearTimeout(dismissTimer)
  zIndex.value = getMaxZIndex() + 100
  isPositioned.value = false
  // 两阶段渲染不变量：测量期必须处于中性状态——重置上一轮坐标，
  // 避免隐藏测量帧挂在旧坐标上（未来若加 max-width/换行，旧坐标处的测量会失真）
  position.x = 0
  position.y = 0
  visible.value = true
  await nextTick()
  const el = tipRef.value
  if (!el) {
    // 元素未挂载属异常路径。纯提示浮层宁可不显示也不出现在错误位置——
    // 区别于 Tooltip 的「至少以默认位置显示」先例（Tooltip 有交互价值，位置错误仍可用）
    console.warn('[MarkFlow] CoachTip 元素未挂载，跳过显示')
    hide()
    return
  }
  const rect = el.getBoundingClientRect()
  const pos = computeTooltipPosition(
    anchorRect,
    { width: rect.width, height: rect.height },
    { width: window.innerWidth, height: window.innerHeight },
  )
  position.x = pos.x
  position.y = pos.y
  isPositioned.value = true
  window.addEventListener('mousedown', hide, true)
  window.addEventListener('scroll', hide, true)
  dismissTimer = window.setTimeout(hide, DISMISS_TIMEOUT_MS)
}

function hide() {
  // 幂等短路：已隐藏时直接返回，让「visible=false ⟹ 监听器/定时器已清理」成为显式不变量，
  // 不再隐式依赖 add/removeEventListener 与 clearTimeout 的幂等性
  if (!visible.value)
    return
  clearTimeout(dismissTimer)
  window.removeEventListener('mousedown', hide, true)
  window.removeEventListener('scroll', hide, true)
  visible.value = false
  isPositioned.value = false
}

onUnmounted(hide)

defineExpose({ show, hide })
</script>

<template>
  <Transition name="coach-tip-pop">
    <div
      v-if="visible"
      ref="tipRef"
      class="coach-tip fixed pointer-events-none select-none rounded-lg border border-gray-200 bg-white px-[12px] py-[8px] font-sans text-[12px] text-gray-600 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      :class="{ 'coach-tip-in': isPositioned }"
      :style="{ top: `${position.y}px`, left: `${position.x}px`, zIndex, visibility: isPositioned ? 'visible' : 'hidden' }"
    >
      <span>{{ t('coachTip.hintPrefix') }}</span>
      <kbd class="mx-[4px] rounded-[4px] border border-amber-300 bg-amber-100 px-[6px] py-[2px] font-mono text-[12px] text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{{ keyLabel }}</kbd>
      <span>{{ t('coachTip.hintSuffix') }}</span>
    </div>
  </Transition>
</template>

<style scoped>
/* 同款 tooltip-pop-in 模式：动画绑定 isPositioned（两阶段渲染的测量期不播动画），
   keyframes 在 scoped 内定义（Shadow DOM 隔离，无法从外部样式复用）。 */
.coach-tip-in {
  animation: coach-tip-in 150ms ease-out;
}
@keyframes coach-tip-in {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(4px);
  }
}
.coach-tip-pop-leave-active {
  transition: opacity 100ms ease-in, transform 100ms ease-in;
}
.coach-tip-pop-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(4px);
}
</style>
