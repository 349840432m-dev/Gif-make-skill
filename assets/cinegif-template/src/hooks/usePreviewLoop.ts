import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnimationSettings, AppMode, CanvasSize, SlideshowSettings, VideoSettings } from '../types'
import { drawFrame } from '../lib/motion'
import { drawSlideshowFrame } from '../lib/slideshowRenderer'
import { drawVideoFrame, seekVideoTo, normalizeVideoClipSettings, calculateVideoPlaybackDuration } from '../lib/videoFrames'
import type { LoadedImage } from '../lib/imageFile'
import type { MultiImageAsset } from '../lib/multiImageAssets'
import type { LoadedVideo } from '../lib/videoFile'

export interface PreviewConfig {
  mode: AppMode
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  canvasSize: CanvasSize
  hasPreview: boolean
  previewDuration: number
  loaded: LoadedImage | null
  settings: AnimationSettings
  slideshowAssets: MultiImageAsset[]
  slideshowSettings: SlideshowSettings
  videoAsset: LoadedVideo | null
  videoSettings: VideoSettings
}

export interface PreviewControls {
  elapsed: number
  isPlaying: boolean
  togglePlay: () => void
  resetPlayback: () => void
  pause: () => void
  seekVideoPreview: (time: number) => void
  error: string
  clearError: () => void
}

function normalizeAppVideoSettings(settings: VideoSettings, duration: number): VideoSettings {
  const normalized = normalizeVideoClipSettings(
    {
      start: settings.startTime,
      end: settings.endTime,
      fps: settings.fps,
      playbackSpeed: settings.playbackSpeed,
      aspectRatio: settings.aspectRatio,
      outputWidth: settings.outputWidth,
    },
    duration,
  )
  return {
    ...settings,
    startTime: normalized.start,
    endTime: normalized.end,
    fps: normalized.fps,
    playbackSpeed: normalized.playbackSpeed,
    aspectRatio: normalized.aspectRatio ?? settings.aspectRatio,
    outputWidth: normalized.outputWidth ?? settings.outputWidth,
  }
}

export { normalizeAppVideoSettings }

export function usePreviewLoop(config: PreviewConfig): PreviewControls {
  const {
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
  } = config

  const [isPlaying, setIsPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const startedAtRef = useRef(0)
  const pausedAtRef = useRef(0)

  useEffect(() => {
    setElapsed(0)
    pausedAtRef.current = 0
    startedAtRef.current = performance.now()
    setIsPlaying(true)
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

  // Video preview path
  useEffect(() => {
    if (mode !== 'video' || !videoAsset || !hasPreview || !canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    const context = canvas.getContext('2d')
    if (!context) {
      setError('当前浏览器无法创建画布，请更换浏览器重试。')
      return
    }

    let animationFrame = 0
    let disposed = false
    const video = videoAsset.video
    const normalized = normalizeAppVideoSettings(videoSettings, videoAsset.duration)
    const playbackDuration = calculateVideoPlaybackDuration({
      start: normalized.startTime,
      end: normalized.endTime,
      playbackSpeed: normalized.playbackSpeed,
    })
    const endTolerance = 0.03

    const drawCurrentVideoFrame = () => {
      drawVideoFrame(context, video, canvasSize)
      const current = Math.max(
        0,
        Math.min(playbackDuration, (video.currentTime - normalized.startTime) / normalized.playbackSpeed),
      )
      setElapsed(current)
    }

    const renderVideo = async () => {
      try {
        const shouldSeekToStart =
          video.currentTime < normalized.startTime ||
          video.currentTime > normalized.endTime + endTolerance
        if (shouldSeekToStart) {
          await seekVideoTo(video, normalized.startTime)
        }
        if (isPlaying) {
          video.playbackRate = normalized.playbackSpeed
          await video.play()
        } else {
          video.pause()
        }

        const tick = () => {
          if (disposed) return
          if (isPlaying && video.currentTime >= normalized.endTime - endTolerance) {
            if (normalized.loop && isPlaying) {
              video.currentTime = normalized.startTime
              video.playbackRate = normalized.playbackSpeed
              void video.play()
            } else {
              video.pause()
              setIsPlaying(false)
            }
          }
          drawCurrentVideoFrame()
          if (isPlaying) animationFrame = requestAnimationFrame(tick)
        }
        animationFrame = requestAnimationFrame(tick)
      } catch (reason) {
        if (!disposed) {
          video.pause()
          setIsPlaying(false)
          setError(reason instanceof Error ? reason.message : '视频预览失败，请缩短片段或更换视频。')
        }
      }
    }

    void renderVideo()
    return () => {
      disposed = true
      video.pause()
      video.playbackRate = 1
      cancelAnimationFrame(animationFrame)
    }
  }, [canvasRef, canvasSize, hasPreview, isPlaying, mode, videoAsset, videoSettings])

  // Single / multi canvas preview path
  useEffect(() => {
    if (mode === 'video' || !hasPreview || !canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    const context = canvas.getContext('2d')
    if (!context) {
      setError('当前浏览器无法创建画布，请更换浏览器重试。')
      return
    }

    let animationFrame = 0
    let disposed = false

    const render = (time: number) => {
      if (!startedAtRef.current) startedAtRef.current = time
      const milliseconds = Math.max(0, isPlaying
        ? pausedAtRef.current + (time - startedAtRef.current)
        : pausedAtRef.current)
      const durationMs = previewDuration * 1000
      const loop = mode === 'single' ? settings.loop : slideshowSettings.loop
      const current = durationMs > 0
        ? loop
          ? Math.max(0, milliseconds % durationMs)
          : Math.max(0, Math.min(milliseconds, durationMs))
        : 0
      const progress = durationMs > 0 ? current / durationMs : 0

      if (mode === 'single' && loaded) {
        drawFrame(context, loaded.image, settings, progress, canvasSize)
      } else if (mode === 'multi') {
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
      }
      setElapsed(current / 1000)
      if (!disposed && isPlaying) animationFrame = requestAnimationFrame(render)
    }

    animationFrame = requestAnimationFrame(render)
    return () => {
      disposed = true
      cancelAnimationFrame(animationFrame)
    }
  }, [
    canvasRef,
    canvasSize,
    hasPreview,
    isPlaying,
    loaded,
    mode,
    previewDuration,
    settings,
    slideshowAssets,
    slideshowSettings,
  ])

  const togglePlay = useCallback(() => {
    setIsPlaying((playing) => {
      if (playing) {
        pausedAtRef.current += performance.now() - startedAtRef.current
        return false
      }
      const loop = mode === 'single'
        ? settings.loop
        : mode === 'multi'
          ? slideshowSettings.loop
          : videoSettings.loop
      if (!loop && pausedAtRef.current >= previewDuration * 1000) {
        pausedAtRef.current = 0
      }
      startedAtRef.current = performance.now()
      return true
    })
  }, [mode, previewDuration, settings.loop, slideshowSettings.loop, videoSettings.loop])

  const resetPlayback = useCallback(() => {
    pausedAtRef.current = 0
    startedAtRef.current = performance.now()
    setElapsed(0)
  }, [])

  const seekVideoPreview = useCallback((time: number) => {
    if (!videoAsset) return
    const targetTime = Math.max(0, Math.min(time, videoAsset.duration))
    const currentSettings = normalizeAppVideoSettings(videoSettings, videoAsset.duration)
    videoAsset.video.pause()
    setIsPlaying(false)
    setElapsed(Math.max(0, (targetTime - currentSettings.startTime) / currentSettings.playbackSpeed))
    void seekVideoTo(videoAsset.video, targetTime)
      .then(() => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (context) drawVideoFrame(context, videoAsset.video, canvasSize)
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : '视频定位失败。')
      })
  }, [canvasRef, canvasSize, videoAsset, videoSettings])

  const pause = useCallback(() => setIsPlaying(false), [])
  const clearError = useCallback(() => setError(''), [])

  return { elapsed, isPlaying, togglePlay, pause, resetPlayback, seekVideoPreview, error, clearError }
}
