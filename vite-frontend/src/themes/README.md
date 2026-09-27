# Mantine 外观系统

`context.tsx` 是唯一主题入口。MantineProvider 生成 CSS 变量，Tailwind 的 `@theme inline` 映射继续支持业务页面的语义类。

- 模式：light / dark / system，保存在 `flvx:theme`。
- 强调色：blue / teal / violet，保存在 `flvx:accent`。
- 跟随系统时监听系统模式变化，也同步其他浏览器标签页的偏好变化。
- `data-mantine-color-scheme` 同时控制 Mantine 和 Tailwind dark 工具类。
- 应用容器与组件材质为实色，页面无需覆写内联模糊或阴影。

新增控件优先使用 Mantine 的主题/默认属性与 Styles API。不要恢复旧的独立 CSS 注入器或整页替换注册器。
