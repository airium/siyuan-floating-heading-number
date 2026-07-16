# 浮动标题编号

[English](https://github.com/airium/siyuan-floating-heading-number/blob/main/README.md)

浮动标题编号插件在思源桌面编辑器的标题旁浮动显示层级编号。编号根据内核返回的完整 BlockDOM 计算，因此即使长文档仅有一部分挂载在编辑器中，编号仍然准确。

## 行为

* 以文档中实际存在的最高标题级别作为编号根级别。
* 使用零占位保留跳过的级别，例如 `1.0.1`。
* 排除块引、标注和查询嵌入中任意深度的标题。
* 分屏编辑器共享同一份完整文档快照，并在影响标题的事务完成后刷新。
* 仅在编辑器左内边距至少为 48 px 时显示编号。
* 为折叠标题控件预留空间，并在侧栏操作、选择、高亮、区域选择和拖动期间隐藏编号。
* 不修改标题块的属性、类、样式、事务或撤销数据。

浮动标题编号默认启用，可在插件设置中进行全局更改。

## 兼容性

需要思源 3.7.1 或更高版本。插件支持 `desktop`、`browser-desktop` 和 `desktop-window`，在发布模式中禁用，且不在移动端前端运行。

实现依赖内部的 `/api/block/getBlockDOM` 端点和思源 Protyle DOM 选择器。这些是兼容性依赖，不是新增的公共 API。

## 开发

安装 Node.js 24+ 和 pnpm，然后运行：

```sh
pnpm install
pnpm check
```

`pnpm build` 会创建 `package.zip` 并检查商城包内容。`pnpm benchmark` 会针对生成的 1 万和 5 万块文档记录分离 BlockDOM 解析及可见规则渲染性能；传入 `--endpoint http://127.0.0.1:6806 --root-id <id>` 还可测量实时内核请求。

## 许可证

AGPL-3.0，详见 [LICENSE](https://github.com/airium/siyuan-floating-heading-number/blob/main/LICENSE)。
