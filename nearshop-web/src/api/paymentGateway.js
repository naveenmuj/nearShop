import axios from 'axios'

// Payment Gateway Configuration
const PAYMENT_CONFIG = {
  razorpay: {
    enabled: true,
    scriptUrl: 'https://checkout.razorpay.com/v1/checkout.js',
    apiEndpoint: 'https://api.razorpay.com',
    modes: ['test', 'production'],
    supportedMethods: ['card', 'upi', 'wallet', 'netbanking'],
    keyId: process.env.REACT_APP_RAZORPAY_KEY_ID,
    description: 'Credit/Debit Card, UPI, Wallets, NetBanking',
    features: {
      saveCard: true,
      tokenization: true,
      expressCheckout: true,
      autoCapture: true,
    },
  },

  phonepe: {
    enabled: true,
    scriptUrl: 'https://mercury.phonepe.com/web/init',
    apiEndpoint: 'https://mercury-api.phonepe.com/api/v1',
    modes: ['sandbox', 'production'],
    supportedMethods: ['upi', 'card', 'wallet', 'bnpl'],
    merchantId: process.env.REACT_APP_PHONEPE_MERCHANT_ID,
    description: 'UPI, Cards, Wallet, Buy Now Pay Later',
    features: {
      saveCard: true,
      cashback: true,
      offers: true,
      autoCapture: true,
    },
    timeout: 30000, // 30 seconds
  },

  gpay: {
    enabled: true,
    scriptUrl: 'https://pay.google.com/gp/p/js/pay.js',
    apiEndpoint: 'https://payments.google.com',
    modes: ['test', 'production'],
    supportedMethods: ['card', 'upi'],
    merchantId: process.env.REACT_APP_GPAY_MERCHANT_ID,
    merchantName: 'NearShop',
    description: 'UPI, Cards, Google Account',
    features: {
      savedCards: true,
      transactionHistory: true,
      biometric: true,
      autoCapture: true,
    },
  },

  cod: {
    enabled: true,
    description: 'Pay when you receive your order',
    features: {
      noFee: false,
      cancelAnytime: true,
      riskFree: true,
    },
  },
}

// Payment Service Class
class PaymentGatewayService {
  constructor() {
    this.loadedScripts = {}
    this.paymentHandlers = {}
    this.initializePaymentHandlers()
  }

  // Initialize payment handler methods
  initializePaymentHandlers() {
    this.paymentHandlers = {
      razorpay: this.handleRazorpayPayment.bind(this),
      phonepe: this.handlePhonePePayment.bind(this),
      gpay: this.handleGooglePayPayment.bind(this),
      cod: this.handleCashOnDelivery.bind(this),
    }
  }

  // Load payment scripts dynamically
  async loadScript(gateway) {
    if (this.loadedScripts[gateway]) {
      return true
    }

    const config = PAYMENT_CONFIG[gateway]
    if (!config || !config.scriptUrl) {
      console.error(`Invalid gateway or missing script URL: ${gateway}`)
      return false
    }

    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = config.scriptUrl
      script.async = true

      script.onload = () => {
        this.loadedScripts[gateway] = true
        resolve(true)
      }

      script.onerror = () => {
        console.error(`Failed to load ${gateway} script`)
        resolve(false)
      }

      document.body.appendChild(script)
    })
  }

  // Razorpay Payment Handler
  async handleRazorpayPayment(paymentData) {
    try {
      const loaded = await this.loadScript('razorpay')
      if (!loaded) {
        throw new Error('Razorpay script failed to load')
      }

      const { orderId, amount, customerEmail, customerPhone } = paymentData

      // Create Razorpay order
      const orderResponse = await axios.post('/api/payments/razorpay/create-order', {
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: `order_${orderId}`,
      })

      return new Promise((resolve, reject) => {
        const options = {
          key: PAYMENT_CONFIG.razorpay.keyId,
          amount: orderResponse.data.amount,
          currency: orderResponse.data.currency,
          name: 'NearShop',
          description: `Order #${orderId}`,
          order_id: orderResponse.data.id,
          customer_id: orderId,
          handler: async (response) => {
            try {
              // Verify payment signature
              const verification = await axios.post('/api/payments/razorpay/verify', {
                orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              })

              resolve({
                status: 'success',
                gateway: 'razorpay',
                data: verification.data,
              })
            } catch (err) {
              reject(new Error('Payment verification failed'))
            }
          },
          prefill: {
            email: customerEmail,
            contact: customerPhone,
          },
          theme: {
            color: '#7C3AED',
          },
          modal: {
            ondismiss: () => {
              reject(new Error('Payment cancelled by user'))
            },
          },
          timeout: 900,
          readonly: {
            email: true,
            contact: true,
          },
        }

        const razorpay = new window.Razorpay(options)
        razorpay.open()
      })
    } catch (err) {
      throw new Error(`Razorpay payment failed: ${err.message}`)
    }
  }

  // PhonePe Payment Handler
  async handlePhonePePayment(paymentData) {
    try {
      const loaded = await this.loadScript('phonepe')
      if (!loaded) {
        // Fallback to API-based integration if SDK not available
        return this.handlePhonePeAPI(paymentData)
      }

      const { orderId, amount, customerEmail, customerPhone } = paymentData

      // Create PhonePe transaction
      const transactionResponse = await axios.post('/api/payments/phonepe/create-transaction', {
        merchantId: PAYMENT_CONFIG.phonepe.merchantId,
        transactionId: `TXN_${orderId}_${Date.now()}`,
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        redirectUrl: `${window.location.origin}/payment/success`,
      })

      // Redirect to PhonePe
      window.location.href = transactionResponse.data.redirectUrl

      return new Promise((resolve, reject) => {
        // Check transaction status after redirect back
        const checkStatus = setInterval(async () => {
          try {
            const statusResponse = await axios.get(
              `/api/payments/phonepe/status/${transactionResponse.data.transactionId}`
            )

            if (statusResponse.data.status === 'SUCCESS') {
              clearInterval(checkStatus)
              resolve({
                status: 'success',
                gateway: 'phonepe',
                data: statusResponse.data,
              })
            } else if (statusResponse.data.status === 'FAILED') {
              clearInterval(checkStatus)
              reject(new Error('PhonePe transaction failed'))
            }
          } catch (err) {
            clearInterval(checkStatus)
            reject(err)
          }
        }, 2000)

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkStatus)
          reject(new Error('PhonePe payment timeout'))
        }, 300000)
      })
    } catch (err) {
      throw new Error(`PhonePe payment failed: ${err.message}`)
    }
  }

  // PhonePe API Fallback
  async handlePhonePeAPI(paymentData) {
    const { orderId, amount } = paymentData

    const response = await axios.post('/api/payments/phonepe/initiate', {
      orderId,
      amount,
    })

    if (response.data.redirectUrl) {
      window.location.href = response.data.redirectUrl
    }

    return response.data
  }

  // Google Pay Handler
  async handleGooglePayPayment(paymentData) {
    try {
      const loaded = await this.loadScript('gpay')
      if (!loaded) {
        throw new Error('Google Pay script failed to load')
      }

      const { orderId, amount, customerEmail } = paymentData

      const paymentsClient = new window.google.payments.api.PaymentsClient({
        environment: 'PRODUCTION',
      })

      const paymentDataRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [
          {
            type: 'CARD',
            parameters: {
              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
              allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX'],
            },
            tokenizationSpecification: {
              type: 'PAYMENT_GATEWAY',
              parameters: {
                gateway: 'razorpay', // Use Razorpay as tokenization gateway
                gatewayMerchantId: PAYMENT_CONFIG.razorpay.keyId,
              },
            },
          },
          {
            type: 'UPI',
          },
        ],
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: amount.toString(),
          currencyCode: 'INR',
        },
        merchantInfo: {
          merchantId: PAYMENT_CONFIG.gpay.merchantId,
          merchantName: PAYMENT_CONFIG.gpay.merchantName,
        },
        callbackIntents: ['PAYMENT_AUTHORIZATION'],
      }

      const response = await paymentsClient.loadPaymentData(paymentDataRequest)

      // Verify with backend
      const verifyResponse = await axios.post('/api/payments/gpay/verify', {
        orderId,
        paymentMethodData: response.paymentMethodData,
      })

      return {
        status: 'success',
        gateway: 'gpay',
        data: verifyResponse.data,
      }
    } catch (err) {
      if (err.statusCode === 'CANCELED') {
        throw new Error('Google Pay payment cancelled')
      }
      throw new Error(`Google Pay payment failed: ${err.message}`)
    }
  }

  // Cash on Delivery
  async handleCashOnDelivery(paymentData) {
    const { orderId } = paymentData

    const response = await axios.post('/api/payments/cod/create', {
      orderId,
    })

    return {
      status: 'success',
      gateway: 'cod',
      data: response.data,
    }
  }

  // Main payment method handler
  async processPayment(gateway, paymentData) {
    if (!this.paymentHandlers[gateway]) {
      throw new Error(`Unsupported payment gateway: ${gateway}`)
    }

    return this.paymentHandlers[gateway](paymentData)
  }

  // Get configuration for a gateway
  getConfig(gateway) {
    return PAYMENT_CONFIG[gateway]
  }

  // Get all enabled gateways
  getEnabledGateways() {
    return Object.keys(PAYMENT_CONFIG).filter((key) => PAYMENT_CONFIG[key].enabled)
  }

  // Validate payment data
  validatePaymentData(paymentData) {
    const required = ['orderId', 'amount']
    const missing = required.filter((field) => !paymentData[field])

    if (missing.length > 0) {
      throw new Error(`Missing required payment fields: ${missing.join(', ')}`)
    }

    if (paymentData.amount <= 0) {
      throw new Error('Payment amount must be greater than 0')
    }

    return true
  }
}

// Export singleton instance
export const paymentGatewayService = new PaymentGatewayService()
export const getPaymentConfig = () => PAYMENT_CONFIG

export default PaymentGatewayService
