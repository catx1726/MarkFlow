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
import { FOLD, isLargeList } from '../composables/foldAnimation'

const props = defineProps<{
  show: boolean
  markCount: number
}>()

type FoldEl = HTMLElement & { _foldTimer?: number }

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

function beforeEnter(el: Element) {
  const target = el as FoldEl
  target.classList.add('fold-animating') // 动画期间禁用内部 sticky，避免吸顶头跟随缩小的容器重新吸附（位置错乱）
  target.style.overflow = 'hidden'
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
  }, d)
}

function afterEnter(el: Element) {
  cleanup(el as FoldEl)
}

function enterCancelled(el: Element) {
  cleanup(el as FoldEl)
}

function beforeLeave(el: Element) {
  const target = el as FoldEl
  target.classList.add('fold-animating')
  target.style.overflow = 'hidden'
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
  }, d)
}

function leaveCancelled(el: Element) {
  cleanup(el as FoldEl)
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

<style>
/* 全局（非 scoped，需穿透到子组件）：折叠动画期间禁用容器内的吸顶定位。
   sticky 元素会跟随正在缩小的容器重新吸附，导致标题跳动/位置错乱 */
.fold-animating .fold-sticky {
  position: static;
}
</style>
