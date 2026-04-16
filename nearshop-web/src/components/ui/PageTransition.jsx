import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * PageTransition - Wraps pages to add smooth enter/exit animations
 * 
 * Usage:
 * <PageTransition>
 *   <YourPageContent />
 * </PageTransition>
 */

export function PageTransition({ children, direction = 'up' }) {
  const [isEntering, setIsEntering] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setIsEntering(true)
  }, [location])

  return (
    <div
      className={`
        transition-all duration-500 ease-out
        ${isEntering ? 'animate-fade-in-up opacity-100' : 'opacity-0'}
      `}
    >
      {children}
    </div>
  )
}

/**
 * SlideTransition - Slide in from side transitions
 */
export function SlideTransition({ children, from = 'left' }) {
  const [isEntering, setIsEntering] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setIsEntering(true)
  }, [location])

  const animationClass = {
    left: 'animate-slide-in-right',
    right: 'animate-slide-in-left',
    up: 'animate-fade-in-up',
    down: 'animate-fade-in-down'
  }[from] || 'animate-fade-in-up'

  return (
    <div className={`${animationClass} transition-all duration-500 ease-out`}>
      {children}
    </div>
  )
}

/**
 * ScaleTransition - Scale in transitions
 */
export function ScaleTransition({ children }) {
  const [isEntering, setIsEntering] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setIsEntering(true)
  }, [location])

  return (
    <div className={`${isEntering ? 'animate-scale-in-center' : 'opacity-0 scale-95'} transition-all duration-400 ease-out`}>
      {children}
    </div>
  )
}

export default PageTransition
