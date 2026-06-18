# CineGIF 接口契约

## 1. 文档范围

本项目无服务端 API。本契约定义 React 调度层与图片素材、视频素材、时间线、渲染和导出模块之间的 TypeScript 接口，保证单图、多图和视频转 GIF 行为可测试。

## 2. 通用结果与错误

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: CineGifError };

interface CineGifError {
  code: ErrorCode;
  message: string;
  recoverable: boolean;
  assetId?: string;
  fileName?: string;
  cause?: unknown;
}
```

模块不得裸 `catch` 后返回空值。可恢复错误返回 `Result` 或通过 Promise reject 明确上抛；取消统一使用 `EXPORT_CANCELLED`。

## 3. 批次导入

```ts
interface ImportLimits {
  maxAssets: 10;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxPixels: number;
  maxVideoBytes: number;
  maxVideoClipSeconds: number;
  maxFrames: number;
}

interface ImportBatchResult {
  accepted: ImageAsset[];
  rejected: Array<{
    fileName: string;
    error: CineGifError;
  }>;
}

async function importImages(
  files: readonly File[],
  current: AssetCollection,
  limits: ImportLimits,
  signal?: AbortSignal,
): Promise<Result<ImportBatchResult>>;
```

前置条件：

- `files` 非空。
- `current + files` 不得超过数量和声明总大小上限。

后置条件：

- 批次级上限失败时返回错误，`current` 不变。
- 逐项失败放入 `rejected`；成功项按输入顺序返回。
- 函数不直接修改 React 状态。

## 4. 视频导入与片段校验

```ts
interface ImportVideoResult {
  asset: VideoAsset;
}

async function importVideo(
  file: File,
  limits: Pick<ImportLimits, "maxVideoBytes">,
  signal?: AbortSignal,
): Promise<Result<ImportVideoResult>>;

interface VideoClipValidationRequest {
  video: VideoAsset;
  clip: VideoClipSettings;
  fps: number;
  maxClipSeconds: number;
  maxFrames: number;
}

function validateVideoClip(
  request: VideoClipValidationRequest,
): Result<{ durationSeconds: number; totalFrames: number }>;
```

前置条件：

- `file` 为单个本地文件，声明格式为 MP4、WebM 或 MOV。
- 视频文件大小默认不得超过 100 MB。

后置条件：

- `importVideo` 必须通过原生 `video` 元素读取元数据和解码能力，不调用 `ffmpeg.wasm`。
- 读取失败返回 `UNSUPPORTED_VIDEO_FORMAT`、`VIDEO_METADATA_FAILED` 或 `VIDEO_DECODE_FAILED`，不得清空当前状态。
- `validateVideoClip` 要求 `0 <= startSeconds < endSeconds <= video.durationSeconds`、片段不超过 8 秒、总帧数不超过 240。

## 5. 素材集合操作

```ts
function appendAssets(
  collection: AssetCollection,
  assets: readonly ImageAsset[],
): Result<AssetCollection>;

function moveAsset(
  collection: AssetCollection,
  assetId: AssetId,
  targetIndex: number,
): Result<AssetCollection>;

function removeAsset(
  collection: AssetCollection,
  assetId: AssetId,
): Result<{
  collection: AssetCollection;
  removed: ImageAsset;
}>;

function deriveMode(assetCount: number): ProjectMode | undefined;
```

- `moveAsset` 的 `targetIndex` 范围为 `0..assetCount - 1`。
- `deriveMode` 仅可用于兼容旧单图/多图入口；新流程的 `ProjectMode` 来自用户显式选择。
- 操作成功返回新集合，原集合不变。
- 不允许重复 ID、未知 ID 或悬空 `orderedIds`。
- 资源释放由调用方在状态提交成功后执行，避免失败时提前销毁。

## 6. 时间线接口

```ts
interface SlideshowFrame {
  currentIndex: number;
  nextIndex: number;
  phase: "hold" | "transition";
  localProgress: number;
}

function resolveSlideshowFrame(
  timeSeconds: number,
  assetCount: number,
  settings: SlideshowSettings,
): Result<SlideshowFrame>;

function resolveVideoFrameTime(
  frameIndex: number,
  fps: number,
  clip: VideoClipSettings,
): Result<number>;
```

- `assetCount` 必须为 2-10。
- 时间可大于总时长，函数按循环归一化。
- `localProgress` 始终在 `[0, 1)`。
- 最后一张的 `nextIndex` 必须为 `0`。
- 非法时长返回 `INVALID_SLIDESHOW_SETTINGS`，不得产生猜测值。
- `resolveVideoFrameTime` 返回视频源时间，必须落在 `[startSeconds, endSeconds]`。
- 视频片段非法返回 `INVALID_VIDEO_CLIP`，不得自动修正开始或结束时间。

## 7. 画布、转场与视频抽帧接口

```ts
interface DrawPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getContainPlacement(
  source: { width: number; height: number },
  canvas: { width: number; height: number },
): Result<DrawPlacement>;

interface TransitionLayer {
  assetIndex: number;
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
}

function getTransitionLayers(
  transition: TransitionId,
  progress: number,
  currentIndex: number,
  nextIndex: number,
): Result<readonly TransitionLayer[]>;

async function drawVideoFrameToCanvas(
  videoElement: HTMLVideoElement,
  timeSeconds: number,
  context: CanvasRenderingContext2D,
  canvas: CanvasSettings,
  signal?: AbortSignal,
): Promise<Result<void>>;
```

- 计算函数为纯函数，不访问 DOM 或 Canvas。
- `progress` 必须在 `[0, 1)`。
- 返回值不得使图片拉伸；具体 `contain` 尺寸由 `getContainPlacement` 提供。
- `none`、`fade`、`slide` 均返回稳定绘制参数；非循环末帧不绘制末图到首图的转场层。
- 预览渲染可直接读取正在播放的原生 `video` 当前帧并绘制到 Canvas；导出抽帧必须使用原生 `video` seek 到目标时间后绘制。
- `drawVideoFrameToCanvas` 失败时返回 `VIDEO_SEEK_FAILED` 或 `PREVIEW_RENDER_FAILED`。

## 8. 统一帧渲染

```ts
interface RenderFrameRequest {
  context: CanvasRenderingContext2D;
  timeSeconds: number;
  mode: ProjectMode;
  assets: readonly ImageAsset[];
  video?: VideoAsset;
  canvas: CanvasSettings;
  single: AnimationSettings;
  slideshow: SlideshowSettings;
  videoClip: VideoClipSettings;
}

function renderFrame(request: RenderFrameRequest): Result<void>;
```

- 单图模式要求 1 张图片，调用既有单图渲染路径。
- 多图模式要求 2-10 张图片，调用多图时间线和转场路径。
- 视频模式要求 1 个视频，调用视频片段时间线和原生视频抽帧路径。
- 每帧先用统一背景色清空画布。
- 同一请求参数必须得到可重复的绘制结果。
- 模式和素材不匹配时返回 `INVALID_ASSET_COUNT`，不得自动切换模式。

## 9. GIF 导出

```ts
interface ExportProgress {
  taskId: string;
  phase: "prepare" | "render" | "encode" | "done";
  completedFrames: number;
  totalFrames: number;
  percent: number;
}

interface ExportGifRequest {
  taskId: string;
  project: ProjectState;
  signal: AbortSignal;
  onProgress: (progress: ExportProgress) => void;
}

async function exportGif(request: ExportGifRequest): Promise<Blob>;
```

- 同一时刻只允许一个活动任务。
- `signal.aborted` 后不得继续编码或发送成功进度。
- `onProgress` 必须单调递增，`percent` 范围为 0-100。
- 成功 Blob 类型为 `image/gif` 且大小大于 0。
- 失败释放临时资源并抛出明确错误；不得清空项目设置。
- UI 仅接受当前 `taskId` 的进度和结果，忽略过期回调。
- 导出前统一校验 `totalFrames <= 240`；视频模式还需校验片段不超过 8 秒。

## 10. 兼容契约

- 既有单图 `MotionId` 和 `AnimationSettings` 字段不删除、不改名。
- 单图默认设置和六种动效调用继续有效。
- 若现有导出入口只接收单张图片，允许通过适配器构造单素材 `ProjectState`；调用方无需了解多图时间线。
- 新接口不要求网络、存储权限或新增运行时依赖。
- 视频转 GIF 新增接口不得改变单图和多图导入、预览、导出的既有调用语义。
- 不暴露 `ffmpeg.wasm`、远程转码或自动格式转换接口。

## 11. 错误码与恢复

| 错误码 | 恢复动作 |
|---|---|
| `BATCH_LIMIT_EXCEEDED` | 减少本次选择数量 |
| `TOTAL_SIZE_EXCEEDED` | 删除或压缩素材 |
| `IMAGE_DECODE_FAILED` | 移除问题文件并重试 |
| `UNSUPPORTED_VIDEO_FORMAT` | 更换 MP4、WebM 或 MOV 文件 |
| `VIDEO_METADATA_FAILED` | 更换文件或重试读取 |
| `VIDEO_DECODE_FAILED` | 更换浏览器可解码的视频 |
| `INVALID_VIDEO_CLIP` | 调整开始、结束时间、片段长度或帧率 |
| `VIDEO_SEEK_FAILED` | 缩短片段、重试或更换视频 |
| `INVALID_ASSET_ORDER` | 保持原顺序并重试 |
| `INVALID_SLIDESHOW_SETTINGS` | 修正展示或转场时长 |
| `PREVIEW_RENDER_FAILED` | 重试解码或删除问题素材 |
| `EXPORT_CANCELLED` | 返回可生成状态 |
| `EXPORT_OUT_OF_MEMORY` | 降低尺寸、帧率、图片数或时长 |
| `DOWNLOAD_BLOCKED` | 复用 Blob 再次下载 |

## 12. 明确不做

- 不定义 HTTP、WebSocket、上传、鉴权、云存储或遥测接口。
- 不定义音频、时间轴、逐张参数、多视频拼接或项目持久化接口。
- 不暴露转场脚本插件或用户自定义执行入口。
- 不定义 `ffmpeg.wasm`、服务端转码或自动切换模式接口。
