# CineGIF 数据与资源规范

## 1. 文档范围

本规范定义单图、多图和视频转 GIF 项目的内存数据、素材限制、画布规则、资源生命周期和隐私边界。它不定义 UI 布局或具体函数实现。

## 2. 类型字典

```ts
type AssetId = string;
type ProjectMode = "single" | "slideshow" | "video";
type TransitionId = "none" | "fade" | "slide";
type AspectRatioId = "original" | "16:9" | "4:3" | "1:1" | "9:16";

interface ImageAsset {
  id: AssetId;
  file: File;
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  sizeBytes: number;
  width: number;
  height: number;
  bitmap: ImageBitmap | HTMLImageElement;
  objectUrl: string;
}

interface CanvasSettings {
  aspectRatio: AspectRatioId;
  originalAspectRatio: number;
  outputWidth: 480 | 640 | 960 | 1280 | 1920 | number; // number 可为当前素材原始宽度
  backgroundColor: "#0B0D12";
  fit: "contain";
}

interface SlideshowSettings {
  transition: TransitionId;
  slideDurationSeconds: number;
  transitionDurationSeconds: number;
  loop: true;
}

interface VideoAsset {
  id: AssetId;
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
  playbackSpeed: 0.5 | 0.75 | 1 | 1.5 | 2 | 3 | number;
}

interface AssetCollection {
  orderedIds: AssetId[];
  byId: Record<AssetId, ImageAsset>;
  totalSizeBytes: number;
}
```

现有 `MotionId`、`AnimationSettings` 和单图默认值保持不变。

## 3. 派生规则

- `assetCount = orderedIds.length`。
- `mode` 是用户显式选择的 `ProjectMode`，不得从 `assetCount` 或 MIME 自动切换。
- `orderedAssets = orderedIds.map(id => byId[id])`。
- `videoClipSourceDurationSeconds = videoClip.endSeconds - videoClip.startSeconds`。
- `videoClipPlaybackDurationSeconds = videoClipSourceDurationSeconds / videoClip.playbackSpeed`。
- `totalDurationSeconds = mode === "slideshow" ? assetCount * slideDurationSeconds : mode === "video" ? videoClipPlaybackDurationSeconds : single.duration`。
- `totalFrames = ceil(totalDurationSeconds * fps)`。
- 多图默认画布比例取导入阶段第一张有效图片 `width / height`；排序后不自动改变原始比例。
- 视频默认画布比例取视频元数据 `width / height`。

## 4. 输入约束

| 项目 | 约束 |
|---|---|
| 格式 | JPEG、PNG、WebP，需 MIME 与实际解码同时通过 |
| 数量 | 项目总计 1-10 张；多图模式为 2-10 张 |
| 单文件大小 | 不超过 20 MB |
| 单图像素 | 不超过 4000 万像素 |
| 项目总大小 | 不超过 60 MB |
| 视频格式 | MP4、WebM、MOV，需浏览器原生 `video` 可解码 |
| 视频文件大小 | 默认不超过 100 MB |
| 视频片段 | 0.1-8 秒，且开始时间小于结束时间 |
| 视频帧预算 | `ceil(((endSeconds - startSeconds) / playbackSpeed) * fps) <= 240` |
| 宽高 | 解码后均须为正整数 |
| 文件名 | 仅展示；不得作为唯一 ID 或可信格式依据 |

- 批次追加先校验追加后的数量和总大小；失败时整批不提交。
- 批次级校验通过后逐项解码；逐项失败不进入集合，成功项保持用户选择顺序。
- `id` 在图片加入项目时生成，在排序期间保持稳定。
- 视频模式只保存 1 个 `VideoAsset`；替换视频先成功读取新视频元数据，再释放旧视频资源。
- 视频文件扩展名只能作为辅助提示，最终以 MIME 与原生解码结果为准。

## 5. 默认值

| 字段 | 默认值 |
|---|---|
| 多图转场 | `fade` |
| 单张展示时长 | `2` 秒 |
| 转场时长 | `0.4` 秒 |
| 多图循环 | `true`，固定开启 |
| 视频片段开始 | `0` 秒 |
| 视频片段结束 | `min(8, video.durationSeconds)` |
| 视频播放速度 | `1.0x` |
| 输出宽度 | `1280` px，上传素材后可切换到当前素材原始宽度 |
| 帧率 | `12` fps |
| 画布比例 | `original` |
| 适配方式 | `contain` |
| 背景色 | `#0B0D12` |

约束：`0.5 <= slideDurationSeconds <= 5`，`0.2 <= transitionDurationSeconds <= 1`，且 `transitionDurationSeconds < slideDurationSeconds`。视频约束为 `0 <= startSeconds < endSeconds <= video.durationSeconds`、`endSeconds - startSeconds <= 8`、`0.25 <= playbackSpeed <= 4`、`totalFrames <= 240`。

## 6. 顺序与修改语义

- `orderedIds` 是唯一轮播顺序来源。
- 排序操作输入移动项 ID 和目标索引，成功后一次性替换 `orderedIds`。
- 追加把成功素材 ID 放在末尾。
- 删除同时移除 `orderedIds` 和 `byId` 中的对应项，并重新计算总大小。
- 删除、追加、排序后不得出现重复 ID、缺失 ID 或悬空资源。
- 任何素材或顺序变化都使现有导出结果过期。
- 显式切换模式不删除另一模式的内存设置，但当前导出只能读取当前模式素材。
- 视频片段范围、视频文件或输出帧率变化都使现有导出结果过期。

## 7. 资源生命周期

| 资源 | 创建 | 释放 |
|---|---|---|
| `File` 引用 | 文件选择成功 | 删除素材、重置、卸载 |
| `ImageBitmap` | 解码成功 | `close()` 于删除、重置、卸载 |
| `HTMLImageElement` | 解码回退成功 | 清理引用于删除、重置、卸载 |
| `HTMLVideoElement` | 视频元数据读取或抽帧开始 | 替换视频、重置、卸载 |
| 素材对象 URL | 素材加入项目 | 删除素材、重置、卸载 |
| 视频对象 URL | 视频加入项目 | 替换视频、重置、卸载 |
| 导出 Blob URL | GIF 生成成功 | 结果过期、新结果生成、重置、卸载 |
| 临时 Canvas | 预览或导出开始 | 取消、失败、成功、卸载 |

释放操作应幂等；重复调用不得抛出导致流程中断的异常。

## 8. 资源键与文案键

本阶段不新增外部图片、视频或音频资源。转场卡片和视频模式入口使用现有图标库或 CSS 示意。

建议稳定文案键：

- `mode.single`、`mode.slideshow`、`mode.video`
- `transition.none`、`transition.fade`、`transition.slide`
- `asset.add`、`asset.remove`、`asset.moveBefore`、`asset.moveAfter`
- `video.replace`、`video.clipStart`、`video.clipEnd`、`video.frameBudget`
- `error.batchLimit`、`error.totalSize`、`error.decode`、`error.videoDecode`、`error.videoClip`

文案键只用于界面映射，不进入导出文件。

## 9. 隐私与日志字段

允许开发日志字段：`mode`、`assetCount`、`mimeType`、`width`、`height`、`durationBucket`、`sizeBucket`、`transitionId`、`clipDurationSeconds`、`frameBudget`、`taskId`、错误代码和耗时。

禁止日志字段：图片像素、视频帧、Blob 内容、Base64、EXIF、绝对路径、对象 URL、完整文件列表和用户输入的任意内容。文件名只可在当前界面内用于定位失败项。

## 10. 明确不做

- 不定义音频、时间轴、图层、逐张参数、多视频拼接或远程资源数据。
- 不定义项目文件格式、数据库表、云同步结构或迁移协议。
- 不持久化内存状态，不从 EXIF 推导排序或画布方向。
- 不定义 `ffmpeg.wasm` 资源、远程转码资源或视频音轨数据。
