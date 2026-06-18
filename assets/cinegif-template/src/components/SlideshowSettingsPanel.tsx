import { Blend, Ratio, Repeat2, SlidersHorizontal, Timer, Video } from 'lucide-react'
import type {
  AspectRatioId,
  SlideshowSettings,
  TransitionId,
} from '../types'
import type { SelectOption } from './SettingsPanel'
import './components.css'

export interface SlideshowSettingsPanelProps {
  settings: SlideshowSettings
  disabled?: boolean
  widthOptions?: readonly SelectOption<number>[]
  onChange: (changes: Partial<SlideshowSettings>) => void
}

const TRANSITIONS: readonly SelectOption<TransitionId>[] = [
  { value: 'none', label: '直接切换' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'slide', label: '横向滑动' },
]

const FPS_OPTIONS: readonly SelectOption<number>[] = [
  { value: 8, label: '8 FPS · 轻量' },
  { value: 12, label: '12 FPS · 平衡' },
  { value: 18, label: '18 FPS · 流畅' },
  { value: 24, label: '24 FPS · 电影感' },
]

const RATIO_OPTIONS: readonly SelectOption<AspectRatioId>[] = [
  { value: 'original', label: '首图比例' },
  { value: '16:9', label: '16:9 横屏' },
  { value: '4:3', label: '4:3 经典' },
  { value: '1:1', label: '1:1 方形' },
  { value: '9:16', label: '9:16 竖屏' },
]

const WIDTH_OPTIONS: readonly SelectOption<number>[] = [
  { value: 480, label: '480 px' },
  { value: 640, label: '640 px' },
  { value: 960, label: '960 px' },
  { value: 1280, label: '1280 px' },
  { value: 1920, label: '1920 px · 高清' },
]

export function SlideshowSettingsPanel({
  settings,
  disabled = false,
  widthOptions = WIDTH_OPTIONS,
  onChange,
}: SlideshowSettingsPanelProps) {
  return (
    <section className="cg-panel cg-settings">
      <div className="cg-section-heading">
        <span className="cg-section-heading__icon" aria-hidden="true">
          <SlidersHorizontal size={18} />
        </span>
        <div>
          <h2>轮播参数</h2>
          <p>统一设置每张停留时间与图片转场</p>
        </div>
      </div>

      <div className="cg-settings-grid">
        <label className="cg-control cg-control--wide">
          <span className="cg-control__label">
            <span><Timer size={16} aria-hidden="true" />单张停留</span>
            <output>{settings.holdDuration.toFixed(1)} 秒</output>
          </span>
          <input
            className="cg-range"
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={settings.holdDuration}
            disabled={disabled}
            onChange={(event) => onChange({ holdDuration: Number(event.currentTarget.value) })}
          />
        </label>

        <label className="cg-control cg-control--wide">
          <span className="cg-control__label">
            <span><Blend size={16} aria-hidden="true" />转场时长</span>
            <output>{settings.transitionDuration.toFixed(1)} 秒</output>
          </span>
          <input
            className="cg-range"
            type="range"
            min="0"
            max={Math.min(1.5, settings.holdDuration)}
            step="0.1"
            value={Math.min(settings.transitionDuration, settings.holdDuration)}
            disabled={disabled || settings.transition === 'none'}
            onChange={(event) => onChange({ transitionDuration: Number(event.currentTarget.value) })}
          />
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><Blend size={16} aria-hidden="true" />转场效果</span>
          </span>
          <select
            aria-label="转场效果"
            value={settings.transition}
            disabled={disabled}
            onChange={(event) => onChange({ transition: event.currentTarget.value as TransitionId })}
          >
            {TRANSITIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><Video size={16} aria-hidden="true" />帧率</span>
          </span>
          <select
            aria-label="帧率"
            value={settings.fps}
            disabled={disabled}
            onChange={(event) => onChange({ fps: Number(event.currentTarget.value) })}
          >
            {FPS_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><Ratio size={16} aria-hidden="true" />画面比例</span>
          </span>
          <select
            aria-label="画面比例"
            value={settings.aspectRatio}
            disabled={disabled}
            onChange={(event) => onChange({ aspectRatio: event.currentTarget.value as AspectRatioId })}
          >
            {RATIO_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="cg-control">
          <span className="cg-control__label">
            <span><SlidersHorizontal size={16} aria-hidden="true" />输出宽度</span>
          </span>
          <select
            aria-label="输出宽度"
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
          <span className="cg-toggle-control__track" aria-hidden="true"><span /></span>
        </label>
      </div>
    </section>
  )
}
