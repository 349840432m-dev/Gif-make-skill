import { Gauge, Ratio, Repeat2, SlidersHorizontal, Timer, Video, Wind } from 'lucide-react'
import type { AnimationSettings, AspectRatioId } from '../types'
import './components.css'

export interface SelectOption<T extends string | number> {
  value: T
  label: string
}

export interface SettingsPanelProps {
  settings: AnimationSettings
  disabled?: boolean
  className?: string
  durationRange?: { min: number; max: number; step: number }
  intensityRange?: { min: number; max: number; step: number }
  speedRange?: { min: number; max: number; step: number }
  fpsOptions?: readonly SelectOption<number>[]
  aspectRatioOptions?: readonly SelectOption<AspectRatioId>[]
  widthOptions?: readonly SelectOption<number>[]
  onChange: (changes: Partial<AnimationSettings>) => void
}

const DEFAULT_FPS_OPTIONS: readonly SelectOption<number>[] = [
  { value: 8, label: '8 FPS · 轻量' },
  { value: 12, label: '12 FPS · 平衡' },
  { value: 18, label: '18 FPS · 流畅' },
  { value: 24, label: '24 FPS · 电影感' },
]

const DEFAULT_RATIO_OPTIONS: readonly SelectOption<AspectRatioId>[] = [
  { value: 'original', label: '原始比例' },
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

export function SettingsPanel({
  settings,
  disabled = false,
  className = '',
  durationRange = { min: 1, max: 8, step: 0.5 },
  intensityRange = { min: 10, max: 100, step: 5 },
  speedRange = { min: 0.5, max: 2, step: 0.1 },
  fpsOptions = DEFAULT_FPS_OPTIONS,
  aspectRatioOptions = DEFAULT_RATIO_OPTIONS,
  widthOptions = DEFAULT_WIDTH_OPTIONS,
  onChange,
}: SettingsPanelProps) {
  return (
    <section className={`cg-panel cg-settings ${className}`.trim()}>
      <div className="cg-section-heading">
        <span className="cg-section-heading__icon" aria-hidden="true">
          <SlidersHorizontal size={18} />
        </span>
        <div>
          <h2>动效参数</h2>
          <p>微调节奏、幅度与输出尺寸</p>
        </div>
      </div>

      <div className="cg-settings-grid">
        <label className="cg-control cg-control--wide">
          <span className="cg-control__label">
            <span><Timer size={16} aria-hidden="true" />播放时长</span>
            <output>{settings.duration.toFixed(1)} 秒</output>
          </span>
          <input
            className="cg-range"
            type="range"
            min={durationRange.min}
            max={durationRange.max}
            step={durationRange.step}
            value={settings.duration}
            disabled={disabled}
            onChange={(event) => onChange({ duration: Number(event.currentTarget.value) })}
          />
        </label>

        <label className="cg-control cg-control--wide">
          <span className="cg-control__label">
            <span><Gauge size={16} aria-hidden="true" />动效强度</span>
            <output>{settings.intensity}%</output>
          </span>
          <input
            className="cg-range"
            type="range"
            min={intensityRange.min}
            max={intensityRange.max}
            step={intensityRange.step}
            value={settings.intensity}
            disabled={disabled}
            onChange={(event) => onChange({ intensity: Number(event.currentTarget.value) })}
          />
        </label>

        <label className="cg-control cg-control--wide">
          <span className="cg-control__label">
            <span><Wind size={16} aria-hidden="true" />运动速度</span>
            <output>{settings.speed.toFixed(1)} 倍</output>
          </span>
          <input
            className="cg-range"
            type="range"
            min={speedRange.min}
            max={speedRange.max}
            step={speedRange.step}
            value={settings.speed}
            disabled={disabled}
            onChange={(event) => onChange({ speed: Number(event.currentTarget.value) })}
          />
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><Video size={16} aria-hidden="true" />帧率</span>
          </span>
          <select
            value={settings.fps}
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
            <span><Ratio size={16} aria-hidden="true" />画面比例</span>
          </span>
          <select
            value={settings.aspectRatio}
            disabled={disabled}
            onChange={(event) => onChange({ aspectRatio: event.currentTarget.value as AspectRatioId })}
          >
            {aspectRatioOptions.map((option) => (
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
            disabled={disabled}
            onChange={(event) => onChange({ outputWidth: Number(event.currentTarget.value) })}
          >
            {widthOptions.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="cg-toggle-control">
          <span className="cg-control__label">
            <span><Repeat2 size={16} aria-hidden="true" />循环播放</span>
          </span>
          <input
            type="checkbox"
            checked={settings.loop}
            disabled={disabled}
            onChange={(event) => onChange({ loop: event.currentTarget.checked })}
          />
          <span className="cg-toggle-control__track" aria-hidden="true">
            <span />
          </span>
        </label>
      </div>
    </section>
  )
}
