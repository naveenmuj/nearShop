import { useState, useCallback } from 'react'

const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null) // 'pending', 'success', 'failed'

  const initializeRazorpay = useCallback(async (options) => {
    return new Promise((resolve) => {
      if (!window.Razorpay) {
        resolve(false)
        return
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
      resolve(true)
    })
  }, [])

  const initializePhonePe = useCallback(async (options) => {
    // PhonePe implementation
    if (!window.PhonePe) {
      return false
    }

    try {
      // Initialize PhonePe with options
      return true
    } catch (err) {
      setError('Failed to initialize PhonePe')
      return false
    }
  }, [])

  const initializeGooglePay = useCallback(async (options) => {
    // Google Pay implementation
    if (!window.google?.payments?.api?.PaymentsClient) {
      return false
    }

    try {
      const paymentsClient = new window.google.payments.api.PaymentsClient({
        environment: 'PRODUCTION', // or 'TEST'
      })

      // Check readiness
      const isReadyToPayRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [
          {
            type: 'CARD',
            parameters: {
              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
              allowedCardNetworks: ['MASTERCARD', 'VISA'],
            },
          },
          {
            type: 'UPI',
          },
        ],
      }

      const isReadyToPayResponse = await paymentsClient.isReadyToPay(isReadyToPayRequest)
      return isReadyToPayResponse.result
    } catch (err) {
      setError('Failed to initialize Google Pay')
      return false
    }
  }, [])

  const validatePaymentData = useCallback((paymentData) => {
    if (!paymentData || !paymentData.amount || !paymentData.orderId) {
      setError('Invalid payment data')
      return false
    }
    return true
  }, [])

  const handlePaymentError = useCallback((err, method) => {
    const errorMessage = err.response?.data?.detail || err.message || `${method} payment failed`
    setError(errorMessage)
    setPaymentStatus('failed')
    return errorMessage
  }, [])

  const handlePaymentSuccess = useCallback((method, orderData) => {
    setPaymentStatus('success')
    setError(null)
    setIsProcessing(false)
    return {
      status: 'success',
      method,
      data: orderData,
    }
  }, [])

  return {
    isProcessing,
    setIsProcessing,
    error,
    setError,
    paymentStatus,
    setPaymentStatus,
    initializeRazorpay,
    initializePhonePe,
    initializeGooglePay,
    validatePaymentData,
    handlePaymentError,
    handlePaymentSuccess,
  }
}

export default usePayment
