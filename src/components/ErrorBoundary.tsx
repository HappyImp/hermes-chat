import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-bg text-text p-8">
          <div className="text-6xl mb-4">😵</div>
          <h1 className="text-2xl font-bold mb-2">出错了</h1>
          <p className="text-text2 mb-4 text-center max-w-md">
            页面遇到了一个意外错误，请刷新页面重试。
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            刷新页面
          </button>
          {this.state.error && (
            <details className="mt-4 p-4 bg-surface rounded-lg text-xs text-text2 max-w-lg overflow-auto">
              <summary className="cursor-pointer font-medium">错误详情</summary>
              <pre className="mt-2 whitespace-pre-wrap">{this.state.error.message}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
