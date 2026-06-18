import { Film, Images, Sparkles } from 'lucide-react'
import './multi-image.css'
import type { AppMode } from '../types'

export interface ModeSwitchProps {
  value: AppMode
  disabled?: boolean
  className?: string
  onChange: (mode: AppMode) => void
}

const MODE_OPTIONS = [
  {
    value: 'single',
    label: '单图动效',
    description: '为一张图片添加镜头运动',
    icon: Sparkles,
  },
  {
    value: 'multi',
    label: '多图轮播',
    description: '按顺序播放多张图片',
    icon: Images,
  },
  {
    value: 'video',
    label: '视频转 GIF',
    description: '截取视频片段生成动图',
    icon: Film,
  },
] as const

export function ModeSwitch({
  value,
  disabled = false,
  className = '',
  onChange,
}: ModeSwitchProps) {
  return (
    <div
      className={`cg-mode-switch ${className}`.trim()}
      role="radiogroup"
      aria-label="图片处理模式"
    >
      {MODE_OPTIONS.map((option) => {
        const Icon = option.icon
        const isSelected = option.value === value

        return (
          <button
            className={`cg-mode-switch__option${isSelected ? ' is-selected' : ''}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`切换到${option.label}`}
            disabled={disabled}
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            <span className="cg-mode-switch__icon" aria-hidden="true">
              <Icon size={19} strokeWidth={1.8} />
            </span>
            <span className="cg-mode-switch__copy">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        )
      })}
    </div>
  )
}
