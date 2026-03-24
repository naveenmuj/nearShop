import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'
import ToastProvider from './components/ui/Toast/ToastProvider'
import ConfirmDialogProvider from './components/ui/ConfirmDialog/ConfirmDialogProvider'
import { SoundProvider } from './contexts/SoundContext'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <SoundProvider>
          <ToastProvider>
            <ConfirmDialogProvider>
              <App />
              <Toaster position="top-center" />
            </ConfirmDialogProvider>
          </ToastProvider>
        </SoundProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
