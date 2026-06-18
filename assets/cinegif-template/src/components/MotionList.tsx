import type { ComponentType } from 'react'
import {
  Activity,
  CircleDotDashed,
  MoveHorizontal,
  MoveUp,
  Orbit,
  ScanSearch,
  Sparkles,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { MotionId, MotionPreset } from '../types'
import './components.css'

export interface MotionListProps {
  motions: readonly MotionPreset[]
  selectedMotion: MotionId
  disabled?: boolean
  className?: string
  onSelect: (motion: MotionId) => void
}

const MOTION_ICONS: Record<MotionId, ComponentType<LucideProps>> = {
  zoom: ScanSearch,
  float: MoveUp,
  pulse: Activity,
  sway: MoveHorizontal,
  orbit: Orbit,
  parallax: CircleDotDashed,
}

export function MotionList({
  motions,
  selectedMotion,
  disabled = false,
  className = '',
  onSelect,
}: MotionListProps) {
  return (
    <aside className={`cg-panel cg-motion-panel ${className}`.trim()}>
      <div className="cg-section-heading">
        <span className="cg-section-heading__icon" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <div>
          <h2>镜头动效</h2>
          <p>选择画面的运动方式</p>
        </div>
      </div>

      <div className="cg-motion-list" role="radiogroup" aria-label="镜头动效">
        {motions.map((motion) => {
          const Icon = MOTION_ICONS[motion.id]
          const isSelected = motion.id === selectedMotion

          return (
            <button
              className={`cg-motion${isSelected ? ' is-selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              key={motion.id}
              onClick={() => onSelect(motion.id)}
            >
              <span className="cg-motion__icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <span className="cg-motion__copy">
                <strong>{motion.name}</strong>
                <small>{motion.description}</small>
              </span>
              <span className="cg-motion__radio" aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </aside>
  )
}
