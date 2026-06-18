import type { ReactNode } from 'react'
import { Check, Clapperboard } from 'lucide-react'
import './components.css'

export interface HeaderStep {
  id: string
  label: string
}

export interface HeaderStepsProps {
  activeStep: number
  steps?: readonly HeaderStep[]
  title?: string
  subtitle?: string
  className?: string
  actions?: ReactNode
  onStepClick?: (step: HeaderStep, index: number) => void
}

const DEFAULT_STEPS: readonly HeaderStep[] = [
  { id: 'upload', label: '上传素材' },
  { id: 'motion', label: '设计动效' },
  { id: 'export', label: '导出 GIF' },
]

export function HeaderSteps({
  activeStep,
  steps = DEFAULT_STEPS,
  title = 'CineGIF',
  subtitle = '让静态画面拥有电影镜头感',
  className = '',
  actions,
  onStepClick,
}: HeaderStepsProps) {
  return (
    <header className={`cg-header ${className}`.trim()}>
      <div className="cg-brand">
        <span className="cg-brand__mark" aria-hidden="true">
          <Clapperboard size={22} strokeWidth={1.8} />
        </span>
        <span>
          <strong className="cg-brand__title">{title}</strong>
          <span className="cg-brand__subtitle">{subtitle}</span>
        </span>
      </div>

      {steps.length > 0 && (
        <nav className="cg-steps" aria-label="制作步骤">
          {steps.map((step, index) => {
            const isComplete = index < activeStep
            const isActive = index === activeStep

            return (
              <div className="cg-step-wrap" key={step.id}>
                {index > 0 && (
                  <span
                    className={`cg-step__line${isComplete || isActive ? ' is-complete' : ''}`}
                    aria-hidden="true"
                  />
                )}
                <button
                  className={`cg-step${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
                  type="button"
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => onStepClick?.(step, index)}
                  disabled={!onStepClick}
                >
                  <span className="cg-step__number" aria-hidden="true">
                    {isComplete ? <Check size={14} strokeWidth={2.4} /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </button>
              </div>
            )
          })}
        </nav>
      )}

      {actions && <div className="cg-header__actions">{actions}</div>}
    </header>
  )
}
