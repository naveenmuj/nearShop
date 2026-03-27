import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getOrderTracking } from '../../../lib/engagement'
import { connectOrderTracking } from '../../../lib/orders'
import useAuthStore from '../../../store/authStore'
import OrderTimeline from '../../../components/OrderTimeline'
import { GenericDetailSkeleton } from '../../../components/ui/ScreenSkeletons'
import { COLORS, SHADOWS, formatDate } from '../../../constants/theme'

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { token } = useAuthStore()

  const [tracking, setTracking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [liveUpdate, setLiveUpdate] = useState(null)
  const wsRef = useRef(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Pulse animation for live indicator
  useEffect(() => {
    if (!wsConnected) return
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [wsConnected])

  // Load initial tracking data
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getOrderTracking(id)
      .then((res) => {
        setTracking(res?.data ?? null)
      })
      .catch(() => {
        setError('Could not load tracking information.')
      })
      .finally(() => setLoading(false))
  }, [id])

  // WebSocket real-time connection
  useEffect(() => {
    if (!id || !token) return

    const ws = connectOrderTracking(id, token, {
      onOpen: () => {
        setWsConnected(true)
      },
      onMessage: (data) => {
        if (data.type === 'order_update' || data.type === 'status_update') {
          setLiveUpdate(data)
          // Update tracking data with new status
          setTracking((prev) => {
            if (!prev) return prev
            const newTimeline = [...(prev.timeline || [])]
            if (data.status && data.timestamp) {
              newTimeline.push({
                status: data.status,
                timestamp: data.timestamp,
                description: data.description || `Order ${data.status}`,
              })
            }
            return {
              ...prev,
              current_status: data.status || prev.current_status,
              timeline: newTimeline,
            }
          })
          // Clear the live update indicator after 3s
          setTimeout(() => setLiveUpdate(null), 3000)
        }
      },
      onError: () => {
        setWsConnected(false)
      },
      onClose: () => {
        setWsConnected(false)
      },
    })
    wsRef.current = ws

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [id, token])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          {wsConnected && (
            <Animated.View style={[styles.liveIndicator, { opacity: pulseAnim }]}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </Animated.View>
          )}
        </View>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <GenericDetailSkeleton />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>📦</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setError(null)
              setLoading(true)
              getOrderTracking(id)
                .then((res) => setTracking(res?.data ?? null))
                .catch(() => setError('Could not load tracking information.'))
                .finally(() => setLoading(false))
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Order summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order ID</Text>
              <Text style={styles.summaryValue}>
                #{(id || '').replace(/-/g, '').slice(-8).toUpperCase()}
              </Text>
            </View>
            {tracking?.estimated_delivery ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estimated Delivery</Text>
                <Text style={[styles.summaryValue, styles.summaryEstimate]}>
                  {formatDate(tracking.estimated_delivery)}
                </Text>
              </View>
            ) : null}
            {tracking?.current_status ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Current Status</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {tracking.current_status.charAt(0).toUpperCase() +
                      tracking.current_status.slice(1)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Live update toast */}
          {liveUpdate && (
            <View style={styles.liveUpdateToast}>
              <Text style={styles.liveUpdateIcon}>🔔</Text>
              <Text style={styles.liveUpdateText}>
                Status updated: {liveUpdate.status?.replace(/_/g, ' ')}
              </Text>
            </View>
          )}

          {/* Timeline */}
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Tracking History</Text>
            <OrderTimeline timeline={tracking?.timeline ?? []} />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    ...SHADOWS.card,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 32,
    color: COLORS.gray700,
    lineHeight: 36,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.gray500,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.red,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray100,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  summaryEstimate: {
    color: COLORS.green,
  },
  statusBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  timelineCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingTop: 16,
    ...SHADOWS.card,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray900,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8FFF3',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1D9E75',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D9E75',
    letterSpacing: 1,
  },
  liveUpdateToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EAF6FF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAD9F0',
  },
  liveUpdateIcon: {
    fontSize: 18,
  },
  liveUpdateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B8BD4',
    flex: 1,
  },
})
