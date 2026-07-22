# 浮动标题编号

[English](https://github.com/airium/siyuan-floating-heading-number/blob/main/README.md)

浮动标题编号插件在思源桌面编辑器的标题旁浮动显示层级编号。编号根据内核返回的完整 BlockDOM 计算，因此即使长文档仅有一部分挂载在编辑器中，编号仍然准确。

## 功能演示

### 编号逻辑

<img width="600" alt="层级标题编号演示" src="https://raw.githubusercontent.com/airium/siyuan-floating-heading-number/main/assets/numbering-logic.gif">

### 在窄视图中自动隐藏

<img width="600" alt="标题编号在窄编辑器中自动隐藏" src="https://raw.githubusercontent.com/airium/siyuan-floating-heading-number/main/assets/narrow-view-auto-hide.gif">

## 行为

* 以文档中实际存在的最高标题级别作为编号根级别。
* 使用零占位保留跳过的级别，例如 `1.0.1`。
* 排除列表、块引、标注和查询嵌入中任意深度的标题。
* 分屏编辑器共享同一份完整文档快照，并在影响标题的事务完成后刷新。
* 可将编号放在标题行左右两侧的外部或内部，也可紧跟在标题文本之后。
* 当对应侧栏窄于配置的最小宽度时，自动隐藏位于标题外部的编号。
* 为折叠标题控件预留空间，并在侧栏操作、选择、高亮、区域选择和拖动期间隐藏编号。
* 不修改标题块的属性、类、样式、事务或撤销数据。

浮动标题编号默认启用。可在插件设置中全局配置编号位置和外部侧栏的最小宽度；默认位置为左侧外部，最小侧栏宽度为 48 px。

## 兼容性

需要思源 3.7.1 或更高版本。插件支持 `desktop`、`browser-desktop` 和 `desktop-window`，在发布模式中禁用，且不在移动端前端运行。

实现依赖内部的 `/api/block/getBlockDOM` 端点和思源 Protyle DOM 选择器。这些是兼容性依赖，不是新增的公共 API。

## 性能基准

以下分离 DOM 合成基准于 2026-07-16 使用 Node.js 24.15.0 和 happy-dom 20.10.6 记录。每个测试文档每十个块包含一个标题，渲染时挂载前 200 个标题，以模拟思源编辑器仅加载部分 DOM 的情况。

|   块数 | BlockDOM 字节数 | 完整树标题数 |    解析耗时 | 可见区域渲染耗时 | 生成的 CSS 字节数 |
| -----: | --------------: | -----------: | ----------: | ---------------: | ----------------: |
| 10,000 |       1,152,956 |        1,000 |   795.71 ms |         15.05 ms |            85,036 |
| 50,000 |       5,808,956 |        5,000 | 3,898.49 ms |          4.32 ms |            85,036 |

两种规模的基准均保持基于完整文档树的精确编号，从不回退到仅对可见标题编号。单元测试另行验证了同时加载的分屏编辑器会合并为一次请求。

浏览器 DOM 解析性能取决于具体实现，因此这些数字用于回归比较，而不是对思源 Chromium 运行时性能的预测。本次运行时没有可用的思源 3.7.1 内核；可运行 `pnpm benchmark -- --endpoint http://127.0.0.1:6806 --root-id <id>`，为真实文档追加内核响应耗时和响应大小测量。

## 开发

安装 Node.js 24+ 和 pnpm，然后运行：

```sh
pnpm install
pnpm check
```

`pnpm build` 会创建 `package.zip` 并检查商城包内容。`pnpm benchmark` 会针对生成的 1 万和 5 万块文档记录分离 BlockDOM 解析及可见规则渲染性能；传入 `--endpoint http://127.0.0.1:6806 --root-id <id>` 还可测量实时内核请求。

## 发布准备

`plugin.json` 是版本号的唯一基准。准备稳定版本时：

1. 在最新的 `main` 分支上运行 `pnpm version:set 0.3.0`，参数使用目标 `主版本.次版本.修订版本`。该命令会同时更新 `plugin.json` 和 `package.json`。
2. 在 `CHANGELOG.md` 中添加形如 `## v0.3.0 - YYYY-MM-DD` 的带日期章节；其中的内容会成为 GitHub Release 说明。
3. 运行 `pnpm check`，检查生成的 `package.zip`，然后提交清单和更新日志的变更并推送到 `main`。
4. 在 GitHub 打开 **Actions > Release > Run workflow**，选择 `main`，输入不带 `v` 前缀的 `0.3.0`。

工作流仅接受从 `main` 发起的发布，并会检查输入与两个清单中的版本是否一致、拒绝已存在的标签或 Release、使用锁定的依赖安装、运行完整的检查/构建/打包验证，以及要求存在匹配的更新日志。全部通过后，它会在触发工作流的提交上创建标签和 Release `v0.3.0`，并且仅附加 `package.zip`。请勿手动创建标签，也不要替换已有 Release 中的文件；任何修正都应发布新版本。

首次发布到集市时，应先创建 GitHub Release，再通过拉取请求将 `airium/siyuan-floating-heading-number` 添加到思源 Bazaar 的 `plugins.txt`。仓库通过审核后，Bazaar 会自动发现后续的 GitHub Release。

## 许可证

AGPL-3.0，详见 [LICENSE](https://github.com/airium/siyuan-floating-heading-number/blob/main/LICENSE)。
