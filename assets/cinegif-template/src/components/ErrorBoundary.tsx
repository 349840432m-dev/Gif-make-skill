import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error.message : '渲染出错，请刷新页面重试。' }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="app-alert" role="alert" style={{ maxWidth: 480, textAlign: 'center' }}>
            <AlertTriangle size={24} />
            <span>{this.state.error}</span>
            <button type="button" onClick={() => this.setState({ error: null })}>
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
