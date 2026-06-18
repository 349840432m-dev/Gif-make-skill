# CineGIF 阶段实现记录

## 1. 实际完成

- 建立 React 19、TypeScript、Vite 8 单页项目。
- 实现中文深色三步引导界面：上传素材、设计动效、导出 GIF。
- 支持 JPG、PNG、WebP，限制 20 MB / 4000 万像素，并覆盖空文件、错误格式和解码失败。
- 实现电影推进、轻盈漂浮、呼吸脉动、左右摇曳、环绕镜头、景深视差六种循环动效。
- 实现 Canvas 实时预览、播放、暂停、重播，以及时长、帧率、强度、速度、比例、宽度和循环设置。
- 使用 `gifenc@1.0.3` 在浏览器主线程逐帧编码 GIF；每帧后让出事件循环，支持进度、取消、失败重试和下载。
- 替换图片和卸载页面时释放对象 URL；取消导出时使用 `AbortSignal` 停止后续帧。
- 使用 `prefers-reduced-motion` 降低界面装饰动画。
- 建立“单图动效 / 多图轮播”的模式切换基础。
- 多图轮播支持 2-10 张图片导入、追加、删除、按钮排序、统一画布预览和 GIF 导出。
- 多图转场支持直接切换、淡入淡出、横向滑动；循环关闭时停在最后一张，不再从末图转回首图。
- 增加多图总大小 60 MB、总像素 8000 万和 GIF 240 帧预算，入口与编码层均有保护。
- 新增“视频转 GIF”第三模式，支持本地 MP4、WebM、MOV 导入、元数据读取、片段开始/结束时间、视频帧率、输出宽度、画面比例和循环设置。
- 视频模式使用浏览器原生 `video` 元素和 Canvas 抽帧，不引入 `ffmpeg.wasm` 或服务端转码。
- GIF 编码器支持异步逐帧绘制，视频导出可在每帧 seek 完成后写入 GIF，并沿用进度、取消、重试和下载链路。
- 视频预览和导出失败会保留素材与设置，并显示可恢复错误。

## 2. 实际改动

- 项目配置：`package.json`、TypeScript、Vite、ESLint、入口 HTML。
- 应用：`src/App.tsx`、`src/styles.css`、`src/types.ts`。
- 组件：`src/components/`。
- 核心模块：`src/lib/imageFile.ts`、`motion.ts`、`gifEncoder.ts`、`multiImageAssets.ts`、`slideshow.ts`、`slideshowRenderer.ts`、`videoFile.ts`、`videoFrames.ts`。
- 测试：`src/lib/*.test.ts`。
- 文档：`README.md`、`docs/`。

## 3. 验证结果

2026-06-15 已运行：

```text
npm run test       -> 3 个测试文件、30 项测试通过
npm run typecheck  -> 通过
npm run lint       -> 通过
npm run build      -> 通过，1578 个模块完成生产构建
npm audit          -> 0 个已知漏洞
```

2026-06-16 已运行：

```text
npm run test       -> 6 个测试文件、60 项测试通过
npm run typecheck  -> 通过
npm run lint       -> 通过
npm run build      -> 通过，1585 个模块完成生产构建
```

2026-06-16 视频转 GIF 阶段已运行：

```text
npm run typecheck  -> 通过
npm run test       -> 通过，最终测试数量见下方最终门禁
npm run lint       -> 通过
npm run build      -> 通过，1590 个模块完成生产构建
```

2026-06-16 视频预览浮点时间修复后已运行：

```text
npm run typecheck                    -> 通过
npm run test -- src/lib/videoFrames.test.ts -> 13 项测试通过
```

2026-06-16 最终门禁已运行：

```text
npm run test       -> 8 个测试文件、80 项测试通过
npm run typecheck  -> 通过
npm run lint       -> 通过
npm run build      -> 通过，1590 个模块完成生产构建
```

生产构建产物：

```text
dist/index.html
dist/assets/index-Cw37qL6g.css
dist/assets/index-DRXqxPfj.js
dist/assets/index-DXxmDrFT.css
dist/assets/index-BOCAOPPz.js
```

## 4. 真实浏览器验收

2026-06-15 在 Codex 内置 Chromium 浏览器完成：

- 上传 160 × 100 PNG 后显示尺寸、大小和 Canvas 预览。
- 实时计时持续前进；暂停后 700 ms 内计时保持不变。
- 六种动效逐一选择，`aria-checked` 均正确切换。
- 帧率切换为 8 FPS、宽度切换为 480 px 后成功编码。
- 生成 GIF 为 484,102 字节，文件头为 `GIF89a`，下载文件名为 `验收图片-动效.gif`。
- 8 秒、24 FPS、1280 px 高负载配置下取消成功，状态显示“已取消导出”，可再次生成。
- 1:1 比例生成 1280 × 1280 Canvas；循环开关可关闭。
- 错误 MIME 输入显示“仅支持 JPG、PNG 或 WebP 图片”且页面未崩溃。
- 1280 px 桌面视口修复后 `scrollWidth <= innerWidth`；390 × 844 视口无横向溢出。
- 浏览器控制台无 warning/error。
- 资源请求只包含 `127.0.0.1:5173` 的应用模块，没有图片或 GIF 外传请求。
- 修复下载按钮无响应：导出完成后改为持久原生下载链接，并提供“新标签页打开”兜底。
- 修复后重新生成 399,075 字节 GIF，文件头为 `GIF89a`，下载文件名为 `下载修复验收-动效.gif`，控制台无 warning/error。
- 2026-06-16 在 Chromium 中完成多图模式验收：切换多图模式、注入 3 张不同尺寸 PNG、下移排序、删除第三张、追加绿色图片、切换横向滑动、设置 8 FPS 和 480 px 后成功导出。
- 多图导出 GIF 为 599,014 字节，文件头为 `GIF89a`，下载文件名为 `轮播-金色-轮播.gif`，下载链接与“新标签页打开”均存在，控制台无 warning/error。
- 2026-06-16 完成单图回归：上传 `单图回归.png`，生成 802,455 字节 GIF，文件头为 `GIF89a`，下载文件名为 `单图回归-动效.gif`，控制台无 warning/error。
- 2026-06-16 验证 390 × 844 视口 `scrollWidth === innerWidth === 390`，新增多图界面无横向溢出。
- 2026-06-16 在 Codex 内置 Chromium 浏览器完成视频模式 UI 验收：三模式入口可见，切换“视频转 GIF”后显示视频上传区、开始/结束时间、帧率、输出宽度、画面比例、循环设置和 `cinegif-视频.gif` 导出文件名。
- Codex 内置 Chromium 不支持文件上传事件，`filechooser` 返回“File uploads are not supported by Codex In-app Browser.”；因此真实视频文件验收改用本机 Chrome DevTools Protocol 执行。
- 2026-06-16 使用本地 `ffmpeg` 只为验收生成 `work/test-video.mp4` 测试素材；应用代码和依赖没有引入 `ffmpeg`。
- 2026-06-16 使用 `work/video-e2e-cdp.mjs` 在 Chrome 149 完成视频端到端验收：上传 `test-video.mp4`，显示 160 × 90 px、00:01、4.7 KB，Canvas 数量为 1，导出按钮可用，生成 `test-video-视频.gif`，下载完成 308,469 字节，文件头为 `GIF89a`。
- 首次视频 E2E 暴露预览时间浮点边界，页面显示 `timeSeconds 必须是非负数。`；已修复预览 elapsed/current 非负夹取，并在 `seekVideoTo` 中把极小负浮点漂移归零。
- 2026-06-17 视频预览改为直接调用隐藏 `HTMLVideoElement.play()` 播放片段，并在 `requestAnimationFrame` 中持续绘制当前视频帧到 Canvas；GIF 导出仍保持逐帧 seek，保证导出帧时间准确。
- 2026-06-17 使用 Chrome 149 DevTools Protocol 上传 `work/test-video.mp4` 后，对 Canvas 两次采样得到不同像素哈希，确认视频预览帧随播放变化而非停留首帧。
- 2026-06-17 将默认输出宽度从 640 px 提升到 1280 px，并为当前素材提供“原素材宽度”输出选项，减少导出尺寸被默认压缩的问题；GIF 仍受 256 色格式限制。
- 2026-06-17 新增顶栏“清空重置”按钮，可释放单图、多图、视频素材、导出 Blob 和临时状态，并回到初始单图上传流程。

尚未在 Safari、Firefox、Edge 手工验收。

## 5. 残留风险

- `gifenc` 对照片使用 256 色且不含抖动，渐变照片可能出现色带。
- 编码位于主线程；虽然每帧后会让出事件循环，但 1280 px、高帧率和长时长组合仍可能明显占用 CPU。
- 视频 seek 质量取决于浏览器对具体编码的原生解码能力；不支持的 MP4/MOV/WebM 编码会在读取或 seek 阶段失败。
- Safari、Firefox、Edge 和低内存设备行为仍需发布前扩大验证。

## 6. 明确不做

- 不实现 AI 人物驱动、逐帧编辑、账号、云存储、服务端编码、音频导出和多视频拼接。
- 不把尚未完成的浏览器验收标记为通过。
