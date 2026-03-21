import { useState } from 'react'
import imageCompression from 'browser-image-compression'
import client from '../api/client'

export default function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)

  const upload = async (file, folder = 'products') => {
    setIsUploading(true)
    setError(null)
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })
      const formData = new FormData()
      formData.append('file', compressed)
      formData.append('folder', folder)
      const { data } = await client.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.url || data.image_url || data
    } catch (err) {
      console.warn('Upload failed, using local URL:', err.message)
      setError(err.message)
      return URL.createObjectURL(file)
    } finally {
      setIsUploading(false)
    }
  }

  return { upload, isUploading, error }
}
