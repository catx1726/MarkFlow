<script setup lang="ts">
/**
 * # 折叠面板（JS 测量高度动画，Issue #80 修正案）
 *
 * 弃用 grid-template-rows 0fr↔1fr：fr 轨道插值让子树每帧参与轨道尺寸
 * 计算，大列表每帧整棵子树重排导致卡顿；分批挂载能消除长任务但产生
 * 「分块出现/消失」的割裂观感。
 *
 * 本方案：内容一次性完整挂载（子树只布局一次），动画作用于外层容器
 * 的固定 px 高度（overflow hidden 裁剪）——每帧仅容器自身与后续兄弟
 * 元素重排，子树不参与，过渡丝滑。超过阈值时缩短时长（同向降级）。
 */
import { FOLD, isLargeList, pinAnchorDuringFold } from '../composables/foldAnimation'

const props = defineProps<{
  show: boolean
  markCount: number
}>()

type FoldEl = HTMLElement & { _foldTimer?: number, _foldPinStop?: () => void }

function durationOf(count: number): number {
  // 大列表距离更长，给更长时间保证丝滑（measured-px 动画对子树零成本）
  return isLargeList(count) ? FOLD.largeListDuration : FOLD.heightDuration
}

function cleanup(el: FoldEl) {
  clearTimeout(el._foldTimer)
  el.classList.remove('fold-animating')
  el.style.transition = ''
  el.style.height = ''
  el.style.overflow = ''
  el.style.opacity = ''
}

/**
 * 动画结束后停止钉扎：留 pinGraceMs 观察期吸收 v-if 移除当帧的残余位移。
 * 校验身份防止快速连点时误杀下一场动画的新钉扎。
 */
function stopPinSoon(el: FoldEl) {
  const pin = el._foldPinStop
  setTimeout(() => {
    if (el._foldPinStop === pin) {
      pin?.()
      el._foldPinStop = undefined
    }
  }, FOLD.pinGraceMs)
}

function beforeEnter(el: Element) {
  const target = el as FoldEl
  target._foldPinStop = pinAnchorDuringFold(target) // 钉扎面板上方的吸顶头，防容器塌缩拖动
  // overflow 用 clip 而非 hidden：clip 不创建滚动容器，内部吸顶头保持
  // 相对视口吸附，收缩时平滑滑入上方吸顶层的背后（hidden 会使 sticky 相对
  // 裁剪盒失效，吸顶头瞬跳回自然位置——即「层级行先消失再抖动」的根因）
  target.classList.add('fold-animating')
  target.style.overflow = 'clip'
  target.style.height = '0px'
  target.style.opacity = '0'
}

function enter(el: Element, done: () => void) {
  const target = el as FoldEl
  const d = durationOf(props.markCount)
  const height = target.scrollHeight
  target.style.transition = `height ${d}ms ease-out, opacity ${d}ms ease-out`
  void target.offsetHeight // 强制 reflow，确保过渡从 0 起始
  target.style.height = `${height}px`
  target.style.opacity = '1'
  target._foldTimer = window.setTimeout(() => {
    cleanup(target) // 动画结束还原为 auto 高度与可见溢出，不裁剪 ⋯ 菜单
    done()
    stopPinSoon(target)
  }, d)
}

function afterEnter(el: Element) {
  cleanup(el as FoldEl)
}

function enterCancelled(el: Element) {
  const target = el as FoldEl
  cleanup(target)
  target._foldPinStop?.() // 中断时立即停止钉扎，避免与新动画的钉扎互相拉扯
  target._foldPinStop = undefined
}

function beforeLeave(el: Element) {
  const target = el as FoldEl
  target._foldPinStop = pinAnchorDuringFold(target)
  target.classList.add('fold-animating')
  target.style.overflow = 'clip'
  target.style.height = `${target.scrollHeight}px` // 从 auto 固定为 px 才能过渡
}

function leave(el: Element, done: () => void) {
  const target = el as FoldEl
  const d = durationOf(props.markCount)
  target.style.transition = `height ${d}ms ease-in, opacity ${d}ms ease-in`
  void target.offsetHeight
  target.style.height = '0px'
  target.style.opacity = '0'
  target._foldTimer = window.setTimeout(() => {
    cleanup(target)
    done()
    stopPinSoon(target)
  }, d)
}

function leaveCancelled(el: Element) {
  const target = el as FoldEl
  cleanup(target)
  target._foldPinStop?.()
  target._foldPinStop = undefined
}
</script>

<template>
  <Transition
    :css="false"
    @before-enter="beforeEnter"
    @enter="enter"
    @after-enter="afterEnter"
    @enter-cancelled="enterCancelled"
    @before-leave="beforeLeave"
    @leave="leave"
    @leave-cancelled="leaveCancelled"
  >
    <div v-if="show">
      <slot />
    </div>
  </Transition>
</template>
