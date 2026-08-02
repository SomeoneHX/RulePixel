# RulePixel

RulePixel 是一个纯前端在线 LaTeX 像素画编辑器。你可以在像素网格上绘制图案，导入图片并转换为像素画，实时查看像素预览，最后复制或下载可以直接用于 LaTeX、DeepSeek 等支持 LaTeX 渲染的平台的代码。

项目使用 Vue 3、TypeScript 和 Vite 构建，无需后端服务，适合部署到 Vercel、Netlify、GitHub Pages 等静态站点平台。

## 功能特性

### 像素绘制

- 支持笔刷、橡皮擦和区域填充三种工具。
- 支持点击绘制，也支持按住鼠标或触控拖拽连续绘制。
- 支持自定义颜色选择器。
- 内置 16 色像素画调色板。
- 支持清空当前画布。
- 支持将画布重置为默认的 `16 × 16`、`9pt` 空白画布。

### 画布设置

- 支持调整画布宽度和高度。
- 尺寸范围为 `4 × 4` 到 `40 × 40`。
- 扩大画布时新增白色像素。
- 缩小画布时裁剪超出部分，并保留可见区域内的原有像素。
- 支持调整 LaTeX `\rule` 的尺寸，范围为 `4pt` 到 `18pt`。
- 支持自动或自定义行间修正值。

### LaTeX 导出

- 根据当前像素矩阵实时生成 LaTeX 代码。
- 支持复制代码到剪贴板。
- 支持下载为 `rulepixel.tex` 文件。
- 支持使用 `\px` 自定义函数生成紧凑代码。
- 支持打开“展开函数”开关，将每个 `\px{...}` 直接展开为完整的 `\color{...}{\rule{...}{...}}`。
- “展开函数”旁提供问号提示，说明部分编辑器可能因为宏函数展开数量过多而触发 KaTeX 错误。

默认输出示例：

```latex
$$
\newcommand{\px}[1]{\color{#1}{\rule{9pt}{9pt}}}
\px{e6484d} \px{ffffff} \px{ffffff} \\[-4pt]
\px{ffffff} \px{e6484d} \px{ffffff} \\[-4pt]
$$
```

打开“展开函数”后，输出会变为：

```latex
$$
\color{e6484d}{\rule{9pt}{9pt}} \color{ffffff}{\rule{9pt}{9pt}} \\[-4pt]
$$
```

展开后的代码不再包含 `\newcommand` 和 `\px` 宏调用，适合遇到以下 KaTeX 错误时尝试：

```text
ParseError: KaTeX parse error: Too many expansions: infinite loop or need to increase maxExpand setting
```

### 图片导入

- 支持选择本地图片文件。
- 图片会被缩放到当前画布的宽高。
- 使用离屏 Canvas 读取像素颜色。
- 关闭图片平滑处理，以获得更明确的像素化效果。
- 透明区域会与白色背景合成。
- 导入结果会替换当前画布，并支持撤销。

### 撤销与重做

- 支持通过工具栏按钮撤销和重做。
- 最多保存 50 步画布历史。
- 历史快照同时保存画布尺寸和像素内容。
- 调整宽高、导入图片、清空和重置等操作都可以撤销。

快捷键：

| 操作系统 | 撤销 | 重做 |
| --- | --- | --- |
| macOS | `Cmd + Z` | `Cmd + Shift + Z` |
| Windows / Linux | `Ctrl + Z` | `Ctrl + Shift + Z` 或 `Ctrl + Y` |

快捷键是全局监听的，不需要先点击画布。但当宽度、高度、规则尺寸或行间修正输入框正在编辑时，快捷键会交给输入框处理，不会修改画布历史。

## 本地自动保存

RulePixel 会自动将最近一次编辑状态保存到浏览器 `localStorage`，刷新页面或重新打开项目后可以恢复：

- 画布宽度和高度
- 像素颜色矩阵
- 规则尺寸
- 当前颜色
- 当前绘图工具

撤销栈和重做栈不会保存到浏览器，以避免本地存储体积不断增长。

本地保存使用的存储键为：

```text
rulepixel-canvas
```

如果浏览器禁用了本地存储、存储空间不足或保存数据格式损坏，编辑器会回退到默认空白画布，不会阻止正常使用。

## 大画布提示

当画布总像素数达到或超过 `1225` 时，画布设置区域会显示警告。因此 `35 × 35` 画布会触发提示：

```text
RangeError: Maximum call stack size exceeded
```

该风险指的是将 LaTeX 复制到部分富文本编辑器时可能出现的调用栈溢出，与 KaTeX 的宏展开错误不是同一个问题。

“展开函数”开关主要用于处理 KaTeX 的：

```text
Too many expansions
```

两种错误需要分别判断，展开函数并不能保证解决富文本编辑器的调用栈错误。

## 行间修正

RulePixel 的像素行使用 LaTeX 的可选行距参数：

```latex
\\[-4pt]
```

由于 `\rule` 位于数学模式中，实际视觉间距会受到数学基线、行框高度、显示公式和渲染器实现的影响，因此不同规则尺寸需要使用经过测试的修正值。

自动模式使用以下校准表：

| 规则尺寸 | 行间修正 |
| ---: | ---: |
| `4pt` | `-8pt` |
| `5pt` | `-7pt` |
| `6pt` | `-6pt` |
| `7pt` | `-5pt` |
| `8pt` | `-4pt` |
| `9pt` | `-4pt` |
| `10pt` | `-4pt` |
| `11pt` | `-4pt` |
| `12pt` | `-4pt` |
| `13pt` | `-3pt` |
| `14pt` | `-3pt` |
| `15pt` | `-3pt` |
| `16pt` | `-3pt` |
| `17pt` | `-3pt` |
| `18pt` | `-3.5pt` |

如果自动模式的结果不符合目标渲染器的表现，可以切换到自定义模式，手动输入 `-3.5`、`-4` 等修正值。

## 中英文切换

顶部工具栏提供中文和英文切换按钮。

- 支持中文 `zh-CN` 和英文 `en`。
- 首次打开时会根据浏览器语言自动选择。
- 语言选择会保存到 `localStorage`。
- 页面文案、工具提示和辅助文本都会同步切换。

## 技术栈

- [Vue 3](https://vuejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Pinia](https://pinia.vuejs.org/)
- [vue-i18n](https://vue-i18n.intlify.dev/)
- [KaTeX](https://katex.org/)
- [lucide-vue-next](https://www.npmjs.com/package/lucide-vue-next)
- [Tailwind CSS](https://tailwindcss.com/) 相关依赖

## 项目结构

```text
RulePixel/
├── public/
│   └── favicon.svg
├── src/
│   ├── i18n/
│   │   ├── index.ts
│   │   └── locales/
│   │       ├── en.ts
│   │       └── zh-CN.ts
│   ├── stores/
│   │   └── editor.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.vue
│   ├── main.ts
│   └── style.css
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

主要职责：

- `src/App.vue`：编辑器页面、工具栏、画布交互、LaTeX 生成、导入和导出。
- `src/stores/editor.ts`：画布状态、像素操作、尺寸调整、历史记录和本地持久化。
- `src/i18n/`：中英文翻译资源与语言选择持久化。
- `src/types/index.ts`：像素颜色、像素矩阵和工具类型定义。
- `src/style.css`：页面布局、响应式样式、像素网格和控件样式。

## 环境要求

- Node.js `20` 或更高版本
- npm `10` 或更高版本

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认情况下，Vite 会在终端显示本地访问地址，通常为：

```text
http://localhost:5173
```

## 生产构建

执行类型检查和生产构建：

```bash
npm run build
```

构建结果会输出到：

```text
dist/
```

本地预览生产构建：

```bash
npm run preview
```

## 部署

RulePixel 是静态站点，不需要后端服务或数据库。

### Vercel / Netlify

1. 导入 GitHub 仓库。
2. 构建命令填写 `npm run build`。
3. 输出目录填写 `dist`。
4. 使用 Node.js 20 或更高版本。

### GitHub Pages

项目已配置 GitHub Actions 自动部署到 GitHub Pages，线上地址为：

<https://someonehx.github.io/RulePixel/>

工作流文件为 `.github/workflows/deploy.yml`。每次推送到 `main` 分支后，工作流会自动执行依赖安装、生产构建和 Pages 部署，也可以在 GitHub Actions 页面手动触发。

首次使用时，在仓库的 `Settings → Pages → Build and deployment` 中将 `Source` 设置为 `GitHub Actions`。

由于这是项目 Pages，Vite 使用仓库名对应的子路径作为 `base`：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/RulePixel/',
  plugins: [vue()],
})
```

如果未来改用自定义域名或用户 Pages 根路径，需要将 `base` 调整为 `/`，并同步调整部署配置。

## 数据与隐私

- RulePixel 不需要账号登录。
- 不上传画作到服务器。
- 图片导入在浏览器本地通过 Canvas 处理。
- 最近一次画作保存在当前浏览器的 `localStorage` 中。
- 清除站点数据会同时清除保存的画作和语言选择。

## 常见问题

### 为什么修改宽度和高度后像素数量会变化？

宽度和高度修改后会重新生成对应尺寸的二维像素矩阵。扩大时新增区域使用白色填充，缩小时超出区域会被裁剪。该操作可以通过撤销恢复。

### “清空画布”和“重置画布”有什么区别？

- “清空画布”：保留当前宽度、高度和规则尺寸，仅将所有像素改为白色。
- “重置画布”：恢复默认 `16 × 16`、`9pt`，并清空所有像素。

### 为什么右侧预览没有直接使用 KaTeX HTML？

右侧预览使用固定尺寸的像素网格，以避免大画布或大量宏展开影响编辑器交互。LaTeX 代码仍然会在下方实时生成，并可复制或下载。

### 为什么复制到富文本编辑器会失败？

当画布较大时，部分富文本编辑器可能在处理长 LaTeX 文本时触发：

```text
RangeError: Maximum call stack size exceeded
```

当前项目会在 `1225` 个像素及以上显示提醒。可以尝试缩小画布，或者使用下载文件的方式保存代码。

### 为什么 KaTeX 会提示 Too many expansions？

默认输出使用 `\px` 宏。如果宏调用数量较多，KaTeX 可能达到 `maxExpand` 上限。可以打开 LaTeX 输出区域中的“展开函数”开关，让每个像素直接输出完整的 `\color` 和 `\rule`，避免宏展开。

## Git 提交

常用命令：

```bash
git status
git add .
git commit -m "描述本次修改"
git push origin main
```

## 许可证

本项目采用 [MIT License](./LICENSE) 开源。
