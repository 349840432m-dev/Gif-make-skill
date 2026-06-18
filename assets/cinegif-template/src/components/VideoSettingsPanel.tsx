import type { CSSProperties } from 'react'
import { Clock3, Ratio, Repeat2, Scissors, SlidersHorizontal, Video } from 'lucide-react'
import type { AspectRatioId, VideoSettings } from '../types'
import type { SelectOption } from './SettingsPanel'
import './components.css'
import './video-mode.css'

export interface VideoSettingsPanelProps {
  settings: VideoSettings
  disabled?: boolean
  className?: string
  duration?: number
  timeStep?: number
  fpsOptions?: readonly SelectOption<number>[]
  speedOptions?: readonly SelectOption<number>[]
  aspectRatioOptions?: readonly SelectOption<AspectRatioId>[]
  widthOptions?: readonly SelectOption<number>[]
  onChange: (changes: Partial<VideoSettings>) => void
  onPreviewTimeChange?: (time: number) => void
}

const DEFAULT_FPS_OPTIONS: readonly SelectOption<number>[] = [
  { value: 8, label: '8 FPS · 轻量' },
  { value: 12, label: '12 FPS · 平衡' },
  { value: 18, label: '18 FPS · 流畅' },
  { value: 24, label: '24 FPS · 电影感' },
]

const DEFAULT_SPEED_OPTIONS: readonly SelectOption<number>[] = [
  { value: 0.5, label: '0.5x · 慢放' },
  { value: 0.75, label: '0.75x · 稍慢' },
  { value: 1, label: '1.0x · 原速' },
  { value: 1.5, label: '1.5x · 稍快' },
  { value: 2, label: '2.0x · 快放' },
  { value: 3, label: '3.0x · 极速' },
]

const DEFAULT_RATIO_OPTIONS: readonly SelectOption<AspectRatioId>[] = [
  { value: 'original', label: '视频原始比例' },
  { value: '16:9', label: '16:9 横屏' },
  { value: '4:3', label: '4:3 经典' },
  { value: '1:1', label: '1:1 方形' },
  { value: '9:16', label: '9:16 竖屏' },
]

const DEFAULT_WIDTH_OPTIONS: readonly SelectOption<number>[] = [
  { value: 480, label: '480 px' },
  { value: 640, label: '640 px' },
  { value: 960, label: '960 px' },
  { value: 1280, label: '1280 px' },
  { value: 1920, label: '1920 px · 高清' },
]

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return '0.0 秒'

  return `${seconds.toFixed(1)} 秒`
}

function readNumber(value: string) {
  if (value.trim() === '') return null

  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function VideoSettingsPanel({
  settings,
  disabled = false,
  className = '',
  duration,
  timeStep = 0.1,
  fpsOptions = DEFAULT_FPS_OPTIONS,
  speedOptions = DEFAULT_SPEED_OPTIONS,
  aspectRatioOptions = DEFAULT_RATIO_OPTIONS,
  widthOptions = DEFAULT_WIDTH_OPTIONS,
  onChange,
  onPreviewTimeChange,
}: VideoSettingsPanelProps) {
  const maxTime = Number.isFinite(duration) && duration !== undefined
    ? Math.max(0, duration)
    : undefined
  const clipDuration = Math.max(0, settings.endTime - settings.startTime)
  const playbackDuration = settings.playbackSpeed > 0
    ? clipDuration / settings.playbackSpeed
    : clipDuration
  const timelineMax = maxTime ?? Math.max(settings.endTime, settings.startTime + timeStep)
  const minimumClipDuration = Math.max(timeStep, 0.1)
  const safeStart = clamp(settings.startTime, 0, Math.max(0, timelineMax - minimumClipDuration))
  const safeEnd = clamp(settings.endTime, minimumClipDuration, timelineMax)
  const startPercent = timelineMax > 0 ? (safeStart / timelineMax) * 100 : 0
  const endPercent = timelineMax > 0 ? (safeEnd / timelineMax) * 100 : 100

  const updateStartTime = (value: number) => {
    const nextStart = clamp(value, 0, Math.max(0, safeEnd - minimumClipDuration))
    onChange({ startTime: nextStart })
    onPreviewTimeChange?.(nextStart)
  }

  const updateEndTime = (value: number) => {
    const nextEnd = clamp(value, safeStart + minimumClipDuration, timelineMax)
    onChange({ endTime: nextEnd })
    onPreviewTimeChange?.(nextEnd)
  }

  return (
    <section className={`cg-panel cg-settings cg-video-settings ${className}`.trim()}>
      <div className="cg-section-heading">
        <span className="cg-section-heading__icon" aria-hidden="true">
          <Scissors size={18} />
        </span>
        <div>
          <h2>视频参数</h2>
          <p>截取时间段并设置 GIF 输出规格</p>
        </div>
      </div>

      <div className="cg-settings-summary" aria-live="polite">
        源片段 {formatSeconds(clipDuration)} · 导出播放约 {formatSeconds(playbackDuration)}
      </div>

      <div className="cg-video-timeline" aria-label="视频时间轴选段">
        <div className="cg-video-timeline__meta">
          <span>从 {formatSeconds(safeStart)}</span>
          <strong>{formatSeconds(clipDuration)}</strong>
          <span>到 {formatSeconds(safeEnd)}</span>
        </div>
        <div
          className="cg-video-timeline__track"
          style={{
            '--start-percent': `${startPercent}%`,
            '--end-percent': `${endPercent}%`,
          } as CSSProperties}
        >
          <div className="cg-video-timeline__selection" aria-hidden="true" />
          <input
            type="range"
            min={0}
            max={timelineMax}
            step={timeStep}
            value={safeStart}
            aria-label="拖动选择 GIF 开始时间"
            disabled={disabled}
            onChange={(event) => updateStartTime(Number(event.currentTarget.value))}
          />
          <input
            type="range"
            min={0}
            max={timelineMax}
            step={timeStep}
            value={safeEnd}
            aria-label="拖动选择 GIF 结束时间"
            disabled={disabled}
            onChange={(event) => updateEndTime(Number(event.currentTarget.value))}
          />
        </div>
        <div className="cg-video-timeline__actions">
          <button type="button" disabled={disabled} onClick={() => onPreviewTimeChange?.(safeStart)}>
            查看开始帧
          </button>
          <button type="button" disabled={disabled} onClick={() => onPreviewTimeChange?.(safeEnd)}>
            查看结束帧
          </button>
        </div>
      </div>

      <div className="cg-settings-grid">
        <label className="cg-control">
          <span className="cg-control__label">
            <span><Clock3 size={16} aria-hidden="true" />开始时间</span>
            <output>{formatSeconds(settings.startTime)}</output>
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={maxTime}
            step={timeStep}
            value={settings.startTime}
            aria-label="开始时间（秒）"
            disabled={disabled}
            onChange={(event) => {
              const nextValue = readNumber(event.currentTarget.value)
              if (nextValue !== null) updateStartTime(nextValue)
            }}
          />
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><Clock3 size={16} aria-hidden="true" />结束时间</span>
            <output>{formatSeconds(settings.endTime)}</output>
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={maxTime}
            step={timeStep}
            value={settings.endTime}
            aria-label="结束时间（秒）"
            disabled={disabled}
            onChange={(event) => {
              const nextValue = readNumber(event.currentTarget.value)
              if (nextValue !== null) updateEndTime(nextValue)
            }}
          />
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><Video size={16} aria-hidden="true" />帧率</span>
          </span>
          <select
            value={settings.fps}
            aria-label="帧率"
            disabled={disabled}
            onChange={(event) => onChange({ fps: Number(event.currentTarget.value) })}
          >
            {fpsOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><SlidersHorizontal size={16} aria-hidden="true" />播放速度</span>
          </span>
          <select
            value={settings.playbackSpeed}
            aria-label="播放速度"
            disabled={disabled}
            onChange={(event) => onChange({ playbackSpeed: Number(event.currentTarget.value) })}
          >
            {speedOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><SlidersHorizontal size={16} aria-hidden="true" />输出宽度</span>
          </span>
          <select
            value={settings.outputWidth}
            aria-label="输出宽度"
            disabled={disabled}
            onChange={(event) => onChange({ outputWidth: Number(event.currentTarget.value) })}
          >
            {widthOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><Ratio size={16} aria-hidden="true" />画面比例</span>
          </span>
          <select
            value={settings.aspectRatio}
            aria-label="画面比例"
            disabled={disabled}
            onChange={(event) => onChange({ aspectRatio: event.currentTarget.value as AspectRatioId })}
          >
            {aspectRatioOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="cg-toggle-control cg-toggle-control--compact">
          <span className="cg-control__label">
            <span><Repeat2 size={16} aria-hidden="true" />循环播放</span>
          </span>
          <input
            type="checkbox"
            checked={settings.loop}
            aria-label="循环播放"
            disabled={disabled}
            onChange={(event) => onChange({ loop: event.currentTarget.checked })}
          />
          <span className="cg-toggle-control__track" aria-hidden="true"><span /></span>
        </label>
      </div>
    </section>
  )
}
