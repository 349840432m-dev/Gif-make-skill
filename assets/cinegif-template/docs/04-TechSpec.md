# CineGIF 技术方案

## 1. 技术目标

在现有 React、TypeScript、Vite、Canvas、`gifenc` 应用上补齐视频转 GIF 文档链路，同时保持单图和多图接口与行为兼容。浏览器负责文件校验、图片解码、原生视频解码、帧计算、Canvas 绘制、GIF 编码和下载，不引入服务端或 `ffmpeg.wasm`。

## 2. 架构边界

```text
React UI / Flow Coordinator
  ├─ Asset Collection（导入、追加、删除、排序）
  ├─ Single Motion Settings（现有）
  ├─ Slideshow Settings（多图）
  ├─ Video Clip Settings（视频）
  └─ Export State
          ↓
Timeline Resolver（单图时间 / 多图当前素材 / 视频片段时间）
          ↓
Frame Renderer
  ├─ Single Motion Renderer（现有）
  └─ Transition Renderer（none / fade / slide）
  └─ Video Frame Sampler（原生 video + Canvas）
          ↓
Canvas Renderer（统一画布）
          ↓
GIF Exporter（现有 gifenc 管线）
```

核心流程只调度。素材管理、时间映射、转场计算、视频抽帧、单帧绘制和编码保持低耦合；多图和视频能力通过新增模块接入，不修改六种单图动效算法。

## 3. 模块职责

| 模块 | 单一职责 |
|---|---|
| `imageInput` | 校验并解码一批文件，返回逐项结果 |
| `videoInput` | 校验视频文件、读取元数据并建立可 seek 的本地视频资源 |
| `assetCollection` | 维护稳定素材 ID、顺序、追加和删除 |
| `animationPresets` | 保持六种单图动效 |
| `slideshowTimeline` | 将全局时间映射为当前/下一素材及转场进度 |
| `videoClipTimeline` | 将导出帧映射到视频片段内的目标时间 |
| `transitionPresets` | 计算 none、fade、slide 的绘制参数 |
| `videoFrameSampler` | 使用原生 `video` seek 并绘制当前帧到 Canvas |
| `canvasRenderer` | 按统一画布和 `contain` 规则绘制一帧 |
| `previewController` | 驱动预览、暂停、重播和配置变化重启 |
| `gifExporter` | 逐帧编码、进度、取消和 Blob 输出 |
| `objectUrlRegistry` | 创建并释放素材及导出对象 URL |
| React 组件 | 展示状态并调用上述模块，不承载帧算法 |

## 4. 核心数据契约

完整字段和限制见 `05-Data-and-Asset-Spec.md`，接口见 `06-API-Contract.md`。核心形态：

```ts
type ProjectMode = "single" | "slideshow" | "video";
type TransitionId = "none" | "fade" | "slide";

interface ImageAsset {
  id: string;
  file: File;
  width: number;
  height: number;
  bitmap: ImageBitmap | HTMLImageElement;
  objectUrl: string;
}

interface SlideshowSettings {
  transition: TransitionId;
  slideDurationSeconds: number;
  transitionDurationSeconds: number;
  loop: true;
}

interface VideoAsset {
  id: string;
  file: File;
  name: string;
  mimeType: "video/mp4" | "video/webm" | "video/quicktime";
  sizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number;
  objectUrl: string;
}

interface VideoClipSettings {
  startSeconds: number;
  endSeconds: number;
}

interface ProjectState {
  mode: ProjectMode;
  assets: ImageAsset[];
  video?: VideoAsset;
  canvas: CanvasSettings;
  single: AnimationSettings;
  slideshow: SlideshowSettings;
  videoClip: VideoClipSettings;
  export: ExportSettings;
}
```

- `mode` 由用户显式选择，不由素材数量或文件类型自动派生。
- `single` 使用 1 张图片，`slideshow` 使用 2-10 张图片，`video` 使用 1 个视频；不同模式素材不得混合进入同一导出任务。
- 不持久化 `File`、位图、视频对象、Blob 或对象 URL。
- 排序只更新稳定 ID 的顺序，不能重新解码或复制位图。

## 5. 输入与状态约束

- 一批文件先完成批次级数量和总大小校验，再逐项校验 MIME、文件大小、像素和解码。
- 追加后不得超过 10 张、60 MB 或 8000 万总像素；批次级失败时状态不变。
- 逐项失败不加入 `assets`，成功项按选择顺序追加。
- 视频导入先校验 MIME/扩展名、100 MB 文件上限，再通过原生 `video` 读取时长和分辨率；失败时状态不变。
- 视频片段必须满足 `0 <= startSeconds < endSeconds <= durationSeconds`、`endSeconds - startSeconds <= 8` 和帧预算 `ceil((end - start) * fps) <= 240`。
- 删除、排序和批次提交使用不可变更新；失败不得留下中间顺序。
- 删除素材立即停止引用该素材的新帧，并释放其解码资源和对象 URL。
- 所有改变帧结果的操作先取消活动预览帧；导出期间通过 UI 锁定，取消完成后才能修改。

## 6. 统一画布与绘制

- `CanvasSettings` 在当前模式项目内唯一，预览和导出共享。
- 多图“原始比例”取导入阶段第一张有效图片比例；排序后不自动改变已建立的原始比例。
- 视频“原始比例”取视频元数据中的 `videoWidth / videoHeight`。
- 图片和视频帧使用 `contain` 算法居中绘制：`scale = min(canvasWidth / sourceWidth, canvasHeight / sourceHeight)`。
- 每帧先使用 `#0B0D12` 清空画布，再绘制素材；不得依赖透明 GIF 背景。
- 缩略图允许独立裁切，不得复用为导出源。
- 输出尺寸按现有宽度选项和画布比例计算，不无意放大源图的规则保持现有兼容行为。

## 7. 多图时间模型

- 总时长：`assetCount * slideDurationSeconds`。
- 第 `frameIndex` 帧时间：`frameIndex / fps`；总帧数使用 `ceil(totalDuration * fps)`。
- `segmentIndex = floor(time / slideDuration) % assetCount`。
- 当前素材为 `assets[segmentIndex]`，下一素材为 `assets[(segmentIndex + 1) % assetCount]`。
- 每段末尾 `transitionDuration` 进入转场，其余时间只绘制当前素材。
- 转场进度收敛为 `[0, 1)`；导出不重复写入总时长终点帧。

三种转场：

- `fade`：当前图透明度从 1 到 0，下一图从 0 到 1。
- `slide`：当前图向左移出，下一图从右侧移入；两图均遵守统一画布适配。
- `none`：到达下一段时直接切换，不绘制过渡层。

转场函数只返回绘制参数，不直接操作 Canvas。循环开启时最后一张按同一规则转回第一张；循环关闭时停在最后一张，不绘制末图到首图的转场。

## 8. 视频时间模型

- 片段时长：`clipDuration = endSeconds - startSeconds`，范围为 0.1-8 秒。
- 总帧数：`ceil(clipDuration * fps)`，不得超过 240。
- 第 `frameIndex` 帧目标时间：`startSeconds + frameIndex / fps`，最后一帧不得超过 `endSeconds`。
- 预览阶段通过原生 `HTMLVideoElement.play()` 驱动当前片段播放，并在 `requestAnimationFrame` 中持续绘制当前视频帧到 Canvas。
- 导出阶段通过原生 `HTMLVideoElement.currentTime` 定位到目标帧时间，等待 `seeked` 或超时后绘制到 Canvas。
- 只读取视频画面，不读取、不导出音频轨。
- 预览和导出使用同一片段范围、帧率、画布和 `contain` 规则。

## 9. 单图兼容

- `assets.length === 1` 时继续调用现有 `getTransform` 和单图渲染路径。
- 现有 `AnimationSettings` 字段、默认值和六个 `MotionId` 不删除、不改名。
- 单图、多图和视频设置并存；显式模式切换不覆盖另一模式最近一次有效设置。
- `gifExporter` 接收统一帧提供器；现有单图调用可由兼容适配器包装，不要求调用方改写动效参数。

## 10. GIF 导出与并发

- 继续使用锁定的 `gifenc@1.0.3` 和单任务导出模型。
- 同一时间最多一个导出任务；每次任务分配 `taskId` 和独立 `AbortController`。
- 逐帧复用 Canvas，不长期保存全部 RGBA 帧或所有中间帧。
- 取消、失败或配置变更后，旧任务回调必须通过 `taskId` 校验，不能覆盖新状态。
- 每帧后让出事件循环；若真实验收仍阻塞，再通过单独 ADR 评估 Worker，不在本阶段预建 Worker 池。
- 成功后生成 `image/gif` Blob；新结果生成或项目重置时释放旧对象 URL。

## 11. 错误、降级与日志

错误代码至少包括：

- `INVALID_FILE`、`UNSUPPORTED_FORMAT`、`IMAGE_DECODE_FAILED`
- `IMAGE_TOO_LARGE`、`BATCH_LIMIT_EXCEEDED`、`TOTAL_SIZE_EXCEEDED`
- `INVALID_ASSET_COUNT`、`INVALID_ASSET_ORDER`
- `INVALID_SLIDESHOW_SETTINGS`
- `UNSUPPORTED_VIDEO_FORMAT`、`VIDEO_METADATA_FAILED`、`VIDEO_DECODE_FAILED`
- `INVALID_VIDEO_CLIP`、`VIDEO_SEEK_FAILED`
- `CANVAS_UNAVAILABLE`、`PREVIEW_RENDER_FAILED`
- `EXPORT_CANCELLED`、`EXPORT_TIMEOUT`、`EXPORT_OUT_OF_MEMORY`、`EXPORT_FAILED`
- `DOWNLOAD_BLOCKED`

降级顺序：

1. `createImageBitmap` 失败时回退 `HTMLImageElement`。
2. 预览卡顿时降低预览分辨率，不修改导出设置。
3. 编码内存不足时停止，不自动重试，建议降低尺寸、帧率、图片数或时长。
4. 下载被阻止时保留 Blob 并允许再次下载。
5. 视频 seek 失败时停止当前任务，不跳帧生成不完整 GIF；用户可缩短片段或更换文件。

开发日志覆盖批次导入、逐项失败、显式模式变化、排序、删除、视频元数据读取、视频片段校验、预览启动、导出开始/结束/取消/异常，并使用 `taskId` 串联导出。日志不得包含 Blob、像素、绝对路径、对象 URL、视频帧内容或文件内容；文件名仅用于当前界面错误展示，不发送到外部。

## 12. 安全与隐私

- 不发送图片、视频、元数据或 GIF 到网络，不接受远程图片/视频 URL。
- 不使用 localStorage、IndexedDB 或 Cache API 持久化素材。
- 不记录图片 EXIF、视频帧、像素内容、绝对本地路径或对象 URL。
- 不运行用户输入代码，不使用 `eval`。
- 依赖沿用现有锁文件；本阶段不新增运行时依赖。
- 视频处理只使用浏览器原生 `video` 元素和 Canvas，不引入 `ffmpeg.wasm`。

## 13. 验证命令

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

自动化测试至少覆盖数量边界、批次原子性、排序、显式模式切换、统一画布计算、首尾时间映射、三种转场、视频片段范围、帧预算和取消竞态。手工验证覆盖 1/2/10/11 张、横竖图混合、多图删除至 1 张、三种转场、100 MB/8 秒/240 帧视频边界、取消、内存失败和再次下载。

## 14. 明确不做

- 不引入后端、数据库、云存储、服务端编码或远程素材。
- 不实现音频、时间轴、逐张设置、逐段转场、视频裁切框、多视频拼接或单图动效叠加。
- 不改变 GIF 编码库，不预建 Worker 池、插件系统或通用媒体管线。
- 不引入 `ffmpeg.wasm`、后台转码服务或自动格式转换。
- 不持久化项目，也不为超出限制的素材实现分块渲染。
