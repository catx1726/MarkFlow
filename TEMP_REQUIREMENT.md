# TODO

# BUG

- [ ] 流程,你好像没有创建 issue
- [ ] AI CR :
  ```markdown
  1. 严重问题 (Blocking)
    B1: performPull 函数缺少错误边界和重试机制

    文件: src/background/main.ts (line ~400-430)

    问题: performPull 函数在启动时调用，如果网络异常或 GitHub API 限流，只会打印错误日志，没有重试机制。这可能导致用户首次安装时同步失败而无法自动恢复。

    建议: 实现指数退避重试（Exponential Backoff），或至少添加一个定时重试机制。

    async function performPull(retries = 3) {
      for (let i = 0; i < retries; i++) {
        try {
          // ... existing logic ...
          return // 成功则退出
        } catch (error) {
          if (i === retries - 1) {
            console.error('[Sync] Initial pull failed after retries:', error)
            // 通知用户
          } else {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
          }
        }
      }
    }

    B2: mergeMarks 函数未处理删除操作

    文件: src/logic/sync.ts (line 25-44)

    问题: 当前合并逻辑只处理新增和更新，没有处理删除场景。如果用户在设备 A 删除了一个标记，同步到设备 B 时，设备 B 上该标记仍然存在。这是一个数据一致性问题。

    建议: 考虑添加删除标记的同步机制。例如，在 Mark 接口中添加 deletedAt 字段，或者在同步数据中包含已删除的 ID 列表。

    export interface Mark {
      // ... existing fields
      deletedAt?: number // 删除时间戳，用于同步删除
    }

    B3: connectSync 函数未处理 Token 权限不足的情况

    文件: src/options/Options.vue (line ~95-120)

    问题: 当用户提供的 Token 没有 gist 权限时，GitHub API 会返回 403 错误，但当前的错误处理只显示通用错误信息，没有提示用户检查 Token 权限。

    建议: 在错误处理中区分不同的 HTTP 状态码，给出更具体的错误提示。

    if (res.status === 403) {
      showAlert('Token 权限不足，请确保勾选了 "gist" 权限')
    } else if (res.status === 401) {
      showAlert('Token 无效，请重新生成')
    }
  ```   