import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ImageIcon, Loader, Pause, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  ExportPanel,
  HeaderSteps,
  ModeSwitch,
  MotionList,
  MultiImageList,
  SettingsPanel,
  SlideshowSettingsPanel,
  UploadZone,
  VideoSettingsPanel,
  VideoUploadPanel,
  type SelectOption,
} from './components'
import { useExportTask } from './hooks/useExportTask'
import { normalizeAppVideoSettings, usePreviewLoop } from './hooks/usePreviewLoop'
import { MAX_FRAMES, encodeGif, encodeGifFrames } from './lib/gifEncoder'
import { loadImageFile, releaseLoadedImage, type LoadedImage } from './lib/imageFile'
import { calculateCanvasSize } from './lib/motion'
import {
  loadMultiImageAssets,
  moveImageAsset,
  releaseImageAsset,
  releaseImageAssets,
  removeImageAsset,
  type MultiImageAsset,
} from './lib/multiImageAssets'
import { calculateSlideshowDuration } from './lib/slideshow'
import { drawSlideshowFrame } from './lib/slideshowRenderer'
import { loadVideoFile, releaseLoadedVideo, type LoadedVideo } from './lib/videoFile'
import {
  calculateVideoFrameCount,
  calculateVideoPlaybackDuration,
  drawVideoFrame,
  seekVideoTo,
} from './lib/videoFrames'
import { formatFileSize } from './lib/format'
import {
  DEFAULT_SLIDESHOW_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_VIDEO_SETTINGS,
  MOTION_PRESETS,
  type AnimationSettings,
  type AppMode,
  type SlideshowSettings,
  type VideoSettings,
} from './types'

const WORKFLOW_STEPS = [
  { id: 'upload', label: '上传素材', helper: '选择当前模式的本地素材' },
  { id: 'design', label: '设计动效', helper: '调整预览、片段与输出参数' },
  { id: 'export', label: '导出 GIF', helper: '生成、取消、重试和下载' },
] as const

const BASE_WIDTH_OPTIONS: readonly SelectOption<number>[] = [
  { value: 480, label: '480 px' },
  { value: 640, label: '640 px' },
  { value: 960, label: '960 px' },
  { value: 1280, label: '1280 px' },
  { value: 1920, label: '1920 px · 高清' },
]

function createWidthOptions(sourceWidth?: number): readonly SelectOption<number>[] {
  const rounded = sourceWidth ? Math.round(sourceWidth) : 0
  if (!Number.isFinite(rounded) || rounded <= 0) return BASE_WIDTH_OPTIONS
  const originalOption = { value: rounded, label: `原素材宽度 · ${rounded} px` }
  const rest = BASE_WIDTH_OPTIONS.filter((option) => option.value !== rounded)
  return [originalOption, ...rest]
}

function calculatePreviewFitSize(
  container: HTMLElement,
  canvasSize: { width: number; height: number },
): { width: number; height: number } {
  const style = window.getComputedStyle(container)
  const availableWidth = Math.max(
    1,
    container.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
  )
  const availableHeight = Math.max(
    1,
    container.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom),
  )
  const scale = Math.min(availableWidth / canvasSize.width, availableHeight / canvasSize.height)
  return {
    width: Math.max(1, Math.floor(canvasSize.width * scale)),
    height: Math.max(1, Math.floor(canvasSize.height * scale)),
  }
}

export default function App() {
  const [mode, setMode] = useState<AppMode>('single')
  const [selectedStep, setSelectedStep] = useState(0)
  const [loaded, setLoaded] = useState<LoadedImage | null>(null)
  const [slideshowAssets, setSlideshowAssets] = useState<MultiImageAsset[]>([])
  const [videoAsset, setVideoAsset] = useState<LoadedVideo | null>(null)
  const [settings, setSettings] = useState<AnimationSettings>(DEFAULT_SETTINGS)
  const [slideshowSettings, setSlideshowSettings] = useState<SlideshowSettings>(
    DEFAULT_SLIDESHOW_SETTINGS,
  )
  const [videoSettings, setVideoSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loadedRef = useRef<LoadedImage | null>(null)
  const slideshowAssetsRef = useRef<MultiImageAsset[]>([])
  const videoAssetRef = useRef<LoadedVideo | null>(null)
  const [previewFitSize, setPreviewFitSize] = useState({ width: 0, height: 0 })

  const hasPreview = mode === 'single'
    ? Boolean(loaded)
    : mode === 'multi'
      ? slideshowAssets.length > 0
      : Boolean(videoAsset)
  const canExport = mode === 'single'
    ? Boolean(loaded)
    : mode === 'multi'
      ? slideshowAssets.length >= 2
      : Boolean(videoAsset)
  const normalizedVideoSettings = videoAsset
    ? normalizeAppVideoSettings(videoSettings, videoAsset.duration)
    : videoSettings
  const previewDuration = mode === 'single'
    ? settings.duration
    : mode === 'multi'
      ? slideshowAssets.length >= 2
        ? calculateSlideshowDuration(slideshowAssets.length, slideshowSettings.holdDuration)
        : slideshowSettings.holdDuration
      : videoAsset
        ? calculateVideoPlaybackDuration({
            start: normalizedVideoSettings.startTime,
            end: normalizedVideoSettings.endTime,
            playbackSpeed: normalizedVideoSettings.playbackSpeed,
          })
        : DEFAULT_VIDEO_SETTINGS.endTime
  const canvasSize = useMemo(
    () => {
      const source = mode === 'single'
        ? loaded?.image
        : mode === 'multi'
          ? slideshowAssets[0]?.loaded.image
          : videoAsset?.video
      const aspectRatio = mode === 'single'
        ? settings.aspectRatio
        : mode === 'multi'
          ? slideshowSettings.aspectRatio
          : videoSettings.aspectRatio
      const outputWidth = mode === 'single'
        ? settings.outputWidth
        : mode === 'multi'
          ? slideshowSettings.outputWidth
          : videoSettings.outputWidth
      return source
        ? calculateCanvasSize(
            'naturalWidth' in source ? source.naturalWidth : source.videoWidth,
            'naturalHeight' in source ? source.naturalHeight : source.videoHeight,
            aspectRatio,
            outputWidth,
          )
        : { width: 960, height: 540 }
    },
    [
      loaded,
      mode,
      settings.aspectRatio,
      settings.outputWidth,
      slideshowAssets,
      slideshowSettings.aspectRatio,
      slideshowSettings.outputWidth,
      videoAsset,
      videoSettings.aspectRatio,
      videoSettings.outputWidth,
    ],
  )
  const sourceWidth = mode === 'single'
    ? loaded?.image.naturalWidth
    : mode === 'multi'
      ? slideshowAssets[0]?.width
      : videoAsset?.width
  const widthOptions = useMemo(() => createWidthOptions(sourceWidth), [sourceWidth])
  const fileMeta = loaded
    ? `${loaded.image.naturalWidth} × ${loaded.image.naturalHeight} · ${formatFileSize(loaded.size)}`
    : undefined
  const outputName = mode === 'single'
    ? loaded
      ? `${loaded.name.replace(/\.[^.]+$/, '') || 'cinegif'}-动效.gif`
      : 'cinegif-动效.gif'
    : mode === 'multi'
      ? slideshowAssets[0]
        ? `${slideshowAssets[0].loaded.name.replace(/\.[^.]+$/, '') || 'cinegif'}-轮播.gif`
        : 'cinegif-轮播.gif'
      : videoAsset
        ? `${videoAsset.name.replace(/\.[^.]+$/, '') || 'cinegif'}-视频.gif`
        : 'cinegif-视频.gif'
  const slideshowFrameCount = Math.max(1, Math.round(previewDuration * slideshowSettings.fps))
  const videoFrameCount = videoAsset
    ? calculateVideoFrameCount({
        start: normalizedVideoSettings.startTime,
        end: normalizedVideoSettings.endTime,
        fps: normalizedVideoSettings.fps,
        playbackSpeed: normalizedVideoSettings.playbackSpeed,
      })
    : 1
  const exportDisabledReason =
    mode === 'multi' && slideshowAssets.length > 0 && slideshowAssets.length < 2
      ? '至少需要 2 张图片才能生成轮播 GIF。'
      : mode === 'multi' && slideshowFrameCount > MAX_FRAMES
        ? `当前设置会生成 ${slideshowFrameCount} 帧，超过 ${MAX_FRAMES} 帧上限，请降低停留时间、帧率或图片数量。`
        : mode === 'video' && videoFrameCount > MAX_FRAMES
          ? `当前视频片段会生成 ${videoFrameCount} 帧，超过 ${MAX_FRAMES} 帧上限，请缩短片段、降低帧率或提高播放速度。`
          : ''

  const exportTask = useExportTask()
  const preview = usePreviewLoop({
    mode,
    canvasRef,
    canvasSize,
    hasPreview,
    previewDuration,
    loaded,
    settings,
    slideshowAssets,
    slideshowSettings,
    videoAsset,
    videoSettings,
  })

  const activeStep = !hasPreview ? 0 : exportTask.exportProgress.phase === 'idle' ? 1 : 2
  const displayError = fileError || preview.error

  useEffect(() => {
    loadedRef.current = loaded
  }, [loaded])

  useEffect(() => {
    slideshowAssetsRef.current = slideshowAssets
  }, [slideshowAssets])

  useEffect(() => {
    videoAssetRef.current = videoAsset
  }, [videoAsset])

  useEffect(
    () => () => {
      releaseLoadedImage(loadedRef.current)
      releaseImageAssets(slideshowAssetsRef.current)
      releaseLoadedVideo(videoAssetRef.current)
    },
    [],
  )

  // Reset export when content or settings change
  useEffect(() => {
    exportTask.resetExport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loaded,
    mode,
    settings.motion,
    settings.duration,
    settings.speed,
    slideshowAssets,
    slideshowSettings,
    videoAsset,
    videoSettings,
  ])

  useEffect(() => {
    if (!hasPreview) {
      setSelectedStep(0)
      return
    }
    if (exportTask.exportProgress.phase !== 'idle') {
      setSelectedStep(2)
      return
    }
    setSelectedStep((current) => (current === 0 ? 1 : current))
  }, [exportTask.exportProgress.phase, hasPreview])

  useEffect(() => {
    if (!hasPreview || !stageRef.current) {
      setPreviewFitSize({ width: 0, height: 0 })
      return
    }
    const stage = stageRef.current
    const updateFitSize = () => {
      setPreviewFitSize(calculatePreviewFitSize(stage, canvasSize))
    }
    updateFitSize()
    const observer = new ResizeObserver(updateFitSize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [canvasSize, hasPreview])

  const handleFile = useCallback(async (file: File) => {
    setFileError('')
    setIsLoading(true)
    try {
      const next = await loadImageFile(file)
      setLoaded((previous) => {
        releaseLoadedImage(previous)
        return next
      })
      setSettings((current) => current.outputWidth === DEFAULT_SETTINGS.outputWidth
        ? { ...current, outputWidth: next.image.naturalWidth }
        : current)
    } catch (reason) {
      setFileError(reason instanceof Error ? reason.message : '图片载入失败，请重试。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleMultiFiles = useCallback(async (files: readonly File[]) => {
    setFileError('')
    setIsLoading(true)
    try {
      const next = await loadMultiImageAssets(files, slideshowAssetsRef.current)
      setSlideshowAssets(next)
      if (slideshowAssetsRef.current.length === 0 && next[0]) {
        setSlideshowSettings((current) => current.outputWidth === DEFAULT_SLIDESHOW_SETTINGS.outputWidth
          ? { ...current, outputWidth: next[0].width }
          : current)
      }
    } catch (reason) {
      setFileError(reason instanceof Error ? reason.message : '图片载入失败，请重试。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleVideoFile = useCallback(async (file: File) => {
    setFileError('')
    setIsLoading(true)
    try {
      const next = await loadVideoFile(file)
      setVideoAsset((previous) => {
        releaseLoadedVideo(previous)
        return next
      })
      setVideoSettings((current) => ({
        ...current,
        startTime: 0,
        endTime: Math.min(3, next.duration),
        outputWidth: current.outputWidth === DEFAULT_VIDEO_SETTINGS.outputWidth
          ? next.width
          : current.outputWidth,
      }))
    } catch (reason) {
      setFileError(reason instanceof Error ? reason.message : '视频载入失败，请重试。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleRemove = () => {
    exportTask.cancelExport()
    setLoaded((previous) => {
      releaseLoadedImage(previous)
      return null
    })
    setFileError('')
  }

  const handleRemoveVideo = () => {
    exportTask.cancelExport()
    setVideoAsset((previous) => {
      releaseLoadedVideo(previous)
      return null
    })
    setFileError('')
  }

  const handleResetAll = () => {
    exportTask.cancelExport()
    setLoaded((previous) => {
      releaseLoadedImage(previous)
      return null
    })
    setSlideshowAssets((previous) => {
      releaseImageAssets(previous)
      return []
    })
    setVideoAsset((previous) => {
      releaseLoadedVideo(previous)
      return null
    })
    setSettings(DEFAULT_SETTINGS)
    setSlideshowSettings(DEFAULT_SLIDESHOW_SETTINGS)
    setVideoSettings(DEFAULT_VIDEO_SETTINGS)
    setFileError('')
    setDragging(false)
    setMode('single')
    setSelectedStep(0)
  }

  const handleSettings = (changes: Partial<AnimationSettings>) => {
    setSettings((current) => ({ ...current, ...changes }))
  }

  const handleSlideshowSettings = (changes: Partial<SlideshowSettings>) => {
    setSlideshowSettings((current) => {
      const next = { ...current, ...changes }
      if (next.transition === 'none') next.transitionDuration = 0
      if (next.transition !== 'none' && next.transitionDuration === 0) {
        next.transitionDuration = Math.min(0.4, next.holdDuration)
      }
      next.transitionDuration = Math.min(next.transitionDuration, next.holdDuration)
      return next
    })
  }

  const handleVideoSettings = (changes: Partial<VideoSettings>) => {
    setVideoSettings((current) => {
      const base = { ...current, ...changes }
      if (!videoAssetRef.current) return base
      return normalizeAppVideoSettings(base, videoAssetRef.current.duration)
    })
  }

  const handleModeChange = (nextMode: AppMode) => {
    if (nextMode === mode || exportTask.isExporting) return
    exportTask.cancelExport()
    setMode(nextMode)
    setFileError('')
    setSelectedStep(0)
  }

  const handleMoveAsset = (id: string, offset: -1 | 1) => {
    setSlideshowAssets((current) => {
      const index = current.findIndex((asset) => asset.id === id)
      if (index < 0 || index + offset < 0 || index + offset >= current.length) return current
      return moveImageAsset(current, index, index + offset)
    })
  }

  const handleRemoveAsset = (id: string) => {
    setSlideshowAssets((current) => {
      const removed = current.find((asset) => asset.id === id)
      releaseImageAsset(removed)
      return removeImageAsset(current, id)
    })
  }

  const handleExport = () => {
    if (!canExport || exportTask.isExporting) return
    if (exportDisabledReason) {
      setFileError(exportDisabledReason)
      return
    }
    setFileError('')
    preview.pause()

    exportTask.startExport(async (signal, onProgress) => {
      if (mode === 'single' && loaded) {
        return encodeGif({
          image: loaded.image,
          settings,
          signal,
          onProgress,
        })
      }
      if (mode === 'multi') {
        return encodeGifFrames({
          ...canvasSize,
          fps: slideshowSettings.fps,
          frameCount: slideshowFrameCount,
          loop: slideshowSettings.loop,
          signal,
          onProgress,
          drawFrame: (context, _index, progress) => {
            drawSlideshowFrame({
              context,
              images: slideshowAssets.map((asset) => asset.loaded.image),
              size: canvasSize,
              progress,
              holdDuration: slideshowSettings.holdDuration,
              transitionDuration: slideshowSettings.transitionDuration,
              transition: slideshowSettings.transition,
              loop: slideshowSettings.loop,
            })
          },
        })
      }
      if (videoAsset) {
        const normalized = normalizeAppVideoSettings(videoSettings, videoAsset.duration)
        return encodeGifFrames({
          ...canvasSize,
          fps: normalized.fps,
          frameCount: videoFrameCount,
          loop: normalized.loop,
          signal,
          onProgress,
          drawFrame: async (context, frame) => {
            const frameTime = normalized.startTime + (frame / normalized.fps) * normalized.playbackSpeed
            await seekVideoTo(videoAsset.video, Math.min(frameTime, normalized.endTime))
            if (signal.aborted) {
              throw new DOMException('GIF 导出已取消。', 'AbortError')
            }
            drawVideoFrame(context, videoAsset.video, canvasSize)
          },
        })
      }
      throw new Error('没有可导出的素材。')
    })
  }

  const handleResetExport = () => {
    exportTask.resetExport()
    setSelectedStep(hasPreview ? 1 : 0)
  }

  // ---- Render panels ----

  const uploadPanel = mode === 'single' ? (
    <UploadZone
      previewUrl={loaded?.objectUrl}
      fileName={loaded?.name}
      fileMeta={fileMeta}
      isDragging={dragging}
      disabled={exportTask.isExporting}
      onFileSelect={handleFile}
      onFileError={setFileError}
      onRemove={handleRemove}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDrop={() => setDragging(false)}
    />
  ) : mode === 'multi' ? (
    <MultiImageList
      images={slideshowAssets.map((asset) => ({
        id: asset.id,
        name: asset.loaded.name,
        width: asset.width,
        height: asset.height,
        previewUrl: asset.loaded.objectUrl,
      }))}
      disabled={exportTask.isExporting}
      onFilesAdd={handleMultiFiles}
      onInputError={setFileError}
      onMoveUp={(id) => handleMoveAsset(id, -1)}
      onMoveDown={(id) => handleMoveAsset(id, 1)}
      onRemove={handleRemoveAsset}
    />
  ) : (
    <VideoUploadPanel
      video={videoAsset
        ? {
            name: videoAsset.name,
            width: videoAsset.width,
            height: videoAsset.height,
            duration: videoAsset.duration,
            size: videoAsset.size,
          }
        : null}
      isDragging={dragging}
      disabled={exportTask.isExporting}
      onFileSelect={handleVideoFile}
      onFileError={setFileError}
      onRemove={handleRemoveVideo}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDrop={() => setDragging(false)}
    />
  )

  const designPanel = mode === 'single' ? (
    <MotionList
      motions={MOTION_PRESETS}
      selectedMotion={settings.motion}
      disabled={!loaded || exportTask.isExporting}
      onSelect={(motion) => handleSettings({ motion })}
    />
  ) : mode === 'multi' ? (
    <section className="cg-panel mode-help">
      <strong>多图轮播</strong>
      <span>按顺序播放 2-10 张图片。全局转场、帧率和输出尺寸已固定显示在实时画布下方。</span>
    </section>
  ) : (
    <section className="cg-panel mode-help">
      <strong>视频转 GIF</strong>
      <span>通过浏览器原生 video 播放预览，并在导出时按帧抽取。片段和输出参数已固定显示在实时画布下方。</span>
    </section>
  )

  const stageSettingsPanel = mode === 'single' ? (
    <SettingsPanel
      settings={settings}
      disabled={!loaded || exportTask.isExporting}
      widthOptions={widthOptions}
      onChange={handleSettings}
    />
  ) : mode === 'multi' ? (
    <SlideshowSettingsPanel
      settings={slideshowSettings}
      disabled={slideshowAssets.length < 2 || exportTask.isExporting}
      widthOptions={widthOptions}
      onChange={handleSlideshowSettings}
    />
  ) : (
    <VideoSettingsPanel
      settings={videoSettings}
      duration={videoAsset?.duration}
      disabled={!videoAsset || exportTask.isExporting}
      widthOptions={widthOptions}
      onChange={handleVideoSettings}
      onPreviewTimeChange={preview.seekVideoPreview}
    />
  )

  const exportPanel = (
    <div className="export-stack">
      {exportDisabledReason && (
        <div className="export-note" role="status">
          {exportDisabledReason}
        </div>
      )}
      <ExportPanel
        progress={exportTask.exportProgress}
        fileName={outputName}
        downloadUrl={exportTask.downloadUrl}
        downloadName={outputName}
        disabled={!canExport || Boolean(exportDisabledReason)}
        onExport={handleExport}
        onCancel={exportTask.cancelExport}
        onReset={handleResetExport}
      />
    </div>
  )

  const currentStepPanel = selectedStep === 0
    ? uploadPanel
    : selectedStep === 1
      ? designPanel
      : exportPanel

  return (
    <div className="app-shell">
      <HeaderSteps
        className="app-header"
        activeStep={activeStep}
        steps={[]}
        actions={(
          <div className="app-header-tools">
            <ModeSwitch
              className="header-mode-switch"
              value={mode}
              disabled={exportTask.isExporting}
              onChange={handleModeChange}
            />
            <button
              className="reset-all-button"
              type="button"
              onClick={handleResetAll}
            >
              清空重置
            </button>
          </div>
        )}
      />

      {displayError && (
        <div className="app-alert" role="alert">
          <AlertTriangle size={18} />
          <span>{displayError}</span>
          <button
            type="button"
            onClick={() => { setFileError(''); preview.clearError() }}
            aria-label="关闭错误提示"
          >
            关闭
          </button>
        </div>
      )}

      {isLoading && (
        <div className="app-loading" role="status">
          <Loader size={18} className="spin" />
          <span>正在载入素材…</span>
        </div>
      )}

      <main className="workspace">
        <nav className="workflow-rail" aria-label="制作流程">
          {WORKFLOW_STEPS.map((step, index) => {
            const isComplete = index < activeStep
            const isActive = index === selectedStep

            return (
              <button
                className={`workflow-step${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
                type="button"
                aria-current={isActive ? 'step' : undefined}
                disabled={exportTask.isExporting}
                key={step.id}
                onClick={() => setSelectedStep(index)}
              >
                <span className="workflow-step__number">{index + 1}</span>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.helper}</small>
                </span>
              </button>
            )
          })}
        </nav>

        <section className="stage-panel">
          <div className="stage-heading">
            <div>
              <span className="eyebrow">实时画布</span>
              <h1>
                {hasPreview
                  ? mode === 'single'
                    ? '预览你的动态镜头'
                    : mode === 'multi'
                      ? '预览你的轮播 GIF'
                      : '预览你的视频片段'
                  : mode === 'single'
                    ? '先选择一张想要唤醒的图片'
                    : mode === 'multi'
                      ? '先选择 2-10 张轮播图片'
                      : '先选择一个视频片段'}
              </h1>
            </div>
            <span className="privacy-badge">
              <ShieldCheck size={15} />
              素材仅在本地处理
            </span>
          </div>

          <div ref={stageRef} className={`canvas-stage${hasPreview ? ' has-image' : ''}`}>
            {hasPreview ? (
              <div
                className="canvas-fit"
                style={{
                  width: previewFitSize.width || undefined,
                  height: previewFitSize.height || undefined,
                }}
              >
                <canvas
                  ref={canvasRef}
                  aria-label={
                    mode === 'single'
                      ? '动画实时预览'
                      : mode === 'multi'
                        ? '轮播实时预览'
                        : '视频 GIF 实时预览'
                  }
                />
              </div>
            ) : (
              <div className="canvas-empty">
                <span><ImageIcon size={34} /></span>
                <strong>
                  {mode === 'single'
                    ? '你的动态画面会出现在这里'
                    : mode === 'multi'
                      ? '你的多图轮播会出现在这里'
                      : '你的视频片段会出现在这里'}
                </strong>
                <small>
                  {mode === 'single'
                    ? '支持 JPG、PNG、WebP，所有处理均在浏览器中完成'
                    : mode === 'multi'
                      ? '一次添加 2-10 张图片，可排序、删除和追加'
                      : '支持 MP4、WebM、MOV，截取片段后本地生成 GIF'}
                </small>
              </div>
            )}
          </div>

          <div className="transport">
            <button
              className="transport-button"
              type="button"
              onClick={preview.togglePlay}
              disabled={!hasPreview || exportTask.isExporting}
              aria-label={preview.isPlaying ? '暂停预览' : '播放预览'}
            >
              {preview.isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <div className="transport-time">
              <strong>{preview.elapsed.toFixed(1)} 秒</strong>
              <span>/ {previewDuration.toFixed(1)} 秒</span>
            </div>
            <div className="transport-track" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (preview.elapsed / previewDuration) * 100)}%` }} />
            </div>
            <button
              className="transport-reset"
              type="button"
              onClick={preview.resetPlayback}
              disabled={!hasPreview}
            >
              <RefreshCw size={16} />
              重播
            </button>
          </div>

          <div className="stage-settings">
            {stageSettingsPanel}
          </div>
        </section>

        <aside className="workspace-side">
          {currentStepPanel}
        </aside>
      </main>

      <footer>
        <span>CineGIF · 让静态画面拥有电影镜头感</span>
        <span>本地处理 · 无需登录 · 不上传素材</span>
      </footer>
    </div>
  )
}
