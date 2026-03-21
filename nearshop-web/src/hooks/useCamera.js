import { useState, useRef } from 'react'

export function useCamera() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)

  const openCamera = () => inputRef.current?.click()

  const handleCapture = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const reset = () => { setImage(null); setPreview(null) }

  const InputElement = () => (
    <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCapture} />
  )

  return { image, preview, openCamera, reset, InputElement, inputRef, handleCapture }
}
