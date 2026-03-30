import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Dimensions, BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import useAuthStore from '../../store/authStore';
import { AdminConsoleSkeleton } from '../../components/ui/ScreenSkeletons';

const TABS = [
  { id: 'overview', icon: '🏠', label: 'Overview' },
  { id: 'users', icon: '👥', label: 'Users' },
  { id: 'shops', icon: '🏪', label: 'Shops' },
  { id: 'products', icon: '📦', label: 'Products' },
  { id: 'orders', icon: '🛒', label: 'Orders' },
  { id: 'engagement', icon: '💡', label: 'Engage' },
  { id: 'financial', icon: '💰', label: 'Finance' },
  { id: 'ai_usage', icon: '🤖', label: 'AI' },
];

const PERIODS = ['7d', '30d', '90d'];

export const AdminContext = {
  period: '30d',
  setPeriod: () => {},
};

export default function AdminLayout() {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(business)/more');
  }, [router]);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => h.remove();
  }, [goBack]);

  if (authLoading) {
    return <AdminConsoleSkeleton />;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.authBlock, { paddingTop: Math.max(insets.top, 12) }]}>
          <Text style={styles.authTitle}>Admin access requires sign in</Text>
          <Text style={styles.authSub}>Your session is not ready or has expired. Sign in again and reopen the console.</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/email')} style={styles.authBtn}>
            <Text style={styles.authBtnText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Console</Text>
        </View>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && <OverviewScreen period={period} />}
        {activeTab === 'users' && <UsersScreen period={period} />}
        {activeTab === 'shops' && <ShopsScreen period={period} />}
        {activeTab === 'products' && <ProductsScreen period={period} />}
        {activeTab === 'orders' && <OrdersScreen period={period} />}
        {activeTab === 'engagement' && <EngagementScreen period={period} />}
        {activeTab === 'financial' && <FinancialScreen period={period} />}
        {activeTab === 'ai_usage' && <AiUsageScreen period={period} />}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────
const { width: SCREEN_W } = Dimensions.get('window');

const fmtINR = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);
const fmtNum = v => new Intl.NumberFormat('en-IN').format(v || 0);
const fmtUSD = v => `$${(parseFloat(v) || 0).toFixed(4)}`;
const fmtPct = v => `${(parseFloat(v) || 0).toFixed(1)}%`;
const fmtDate = s => {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return s; }
};

const COLORS = {
  primary: '#3B8BD4', purple: '#7F77DD', green: '#1D9E75', amber: '#EF9F27',
  red: '#E24B4A', gray: '#6B7280', coral: '#D85A30', pink: '#D4537E', teal: '#5DCAA5',
};

const STS_CLR = {
  pending: '#EF9F27', confirmed: '#3B8BD4', preparing: '#7F77DD',
  ready: '#5DCAA5', completed: '#1D9E75', cancelled: '#E24B4A', delivered: '#1D9E75',
};

function KpiCard({ icon, label, value, sub, fmt = 'number' }) {
  const display = fmt === 'currency' ? fmtINR(value) : fmt === 'usd' ? fmtUSD(value) : fmt === 'pct' ? fmtPct(value) : fmtNum(value);
  return (
    <View style={cs.kpiCard}>
      <Text style={cs.kpiIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={cs.kpiValue}>{display}</Text>
        <Text style={cs.kpiLabel}>{label}</Text>
        {sub ? <Text style={cs.kpiSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function SectionCard({ children, title, icon }) {
  return (
    <View style={cs.sectionCard}>
      {title && (
        <View style={cs.sectionHeader}>
          {icon && <Text style={{ fontSize: 16 }}>{icon}</Text>}
          <Text style={cs.sectionTitle}>{title}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

function Badge({ label, color }) {
  return (
    <View style={[cs.badge, { backgroundColor: (color || COLORS.gray) + '18' }]}>
      <Text style={[cs.badgeText, { color: color || COLORS.gray }]}>{label}</Text>
    </View>
  );
}

function MiniBar({ data, maxVal, color, label }) {
  const barWidth = maxVal > 0 ? (data / maxVal) * (SCREEN_W - 140) : 0;
  return (
    <View style={cs.miniBarRow}>
      <Text style={cs.miniBarLabel} numberOfLines={1}>{label}</Text>
      <View style={cs.miniBarTrack}>
        <View style={[cs.miniBarFill, { width: Math.max(barWidth, 2), backgroundColor: color || COLORS.primary }]} />
      </View>
      <Text style={cs.miniBarValue}>{fmtNum(data)}</Text>
    </View>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <View style={cs.emptyState}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>{icon}</Text>
      <Text style={cs.emptyTitle}>{title}</Text>
      {sub && <Text style={cs.emptySub}>{sub}</Text>}
    </View>
  );
}

function Loader() {
  return <AdminConsoleSkeleton />;
}

function useAdminData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await fetcher();
      setData(results);
    } catch (e) {
      console.warn('Admin data error:', e?.message);
    }
    setLoading(false);
  }, deps);

  useState(() => { load(); });
  return { data, loading, reload: load };
}

// ── Import API ────────────────────────────────────────────────────────────────
import * as api from '../../lib/api/admin';

// Chart config for react-native-chart-kit
let LineChartRN, BarChartRN, PieChartRN;
try {
  const chartKit = require('react-native-chart-kit');
  LineChartRN = chartKit.LineChart;
  BarChartRN = chartKit.BarChart;
  PieChartRN = chartKit.PieChart;
} catch (e) {
  // Graceful fallback if chart-kit not available
}

const CHART_CFG = {
  backgroundColor: '#fff',
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (opacity = 1) => `rgba(59, 139, 212, ${opacity})`,
  labelColor: () => '#6B7280',
  propsForDots: { r: '3', strokeWidth: '1', stroke: '#3B8BD4' },
  decimalPlaces: 0,
  style: { borderRadius: 12 },
};

function SimpleChart({ labels, datasets, height = 200, suffix = '' }) {
  if (!LineChartRN || !labels?.length) return null;
  return (
    <LineChartRN
      data={{ labels, datasets }}
      width={SCREEN_W - 48}
      height={height}
      chartConfig={CHART_CFG}
      bezier
      style={{ borderRadius: 12, marginTop: 8 }}
      withDots={labels.length < 15}
      withInnerLines={false}
      yAxisSuffix={suffix}
      fromZero
    />
  );
}

function SimpleBarChart({ labels, data, height = 200, color }) {
  if (!BarChartRN || !labels?.length) return null;
  const cfg = {
    ...CHART_CFG,
    color: (opacity = 1) => color ? `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` : `rgba(59, 139, 212, ${opacity})`,
  };
  return (
    <BarChartRN
      data={{ labels, datasets: [{ data }] }}
      width={SCREEN_W - 48}
      height={height}
      chartConfig={cfg}
      style={{ borderRadius: 12, marginTop: 8 }}
      withInnerLines={false}
      fromZero
      showBarTops={false}
    />
  );
}

// ── Overview Screen ───────────────────────────────────────────────────────────
function OverviewScreen({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const [ov, ug, ot] = await Promise.allSettled([
          api.getOverview(),
          api.getUserGrowth(period),
          api.getOrdersTrend(period),
        ]);
        setData({
          overview: ov.status === 'fulfilled' ? ov.value.data : {},
          userGrowth: ug.status === 'fulfilled' ? ug.value.data : [],
          ordersTrend: ot.status === 'fulfilled' ? ot.value.data : [],
        });
      } catch {}
      setLoading(false);
    })();
  });

  if (loading) return <Loader />;
  const ov = data?.overview || {};

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={cs.kpiGrid}>
        <KpiCard icon="👥" label="Total Users" value={ov.total_users} sub={`+${fmtNum(ov.new_users_7d)} this week`} />
        <KpiCard icon="🏪" label="Active Shops" value={ov.total_shops} sub={`${fmtNum(ov.verified_shops)} verified`} />
        <KpiCard icon="📦" label="Products" value={ov.total_products} sub={`${fmtNum(ov.available_products)} available`} />
        <KpiCard icon="🛒" label="Total Orders" value={ov.total_orders} sub={`+${fmtNum(ov.orders_7d)} this week`} />
        <KpiCard icon="💰" label="GMV" value={ov.gmv_total} fmt="currency" sub={`${fmtINR(ov.gmv_7d)} this week`} />
        <KpiCard icon="⭐" label="Reviews" value={ov.total_reviews} sub={`Avg ${(ov.avg_rating || 0).toFixed(1)}`} />
      </View>

      {data?.userGrowth?.length > 0 && (
        <SectionCard title="User Growth" icon="📈">
          <SimpleChart
            labels={data.userGrowth.slice(-10).map(d => fmtDate(d.date))}
            datasets={[{ data: data.userGrowth.slice(-10).map(d => d.count || 0), color: () => COLORS.primary, strokeWidth: 2 }]}
          />
        </SectionCard>
      )}

      {data?.ordersTrend?.length > 0 && (
        <SectionCard title="Orders Trend" icon="🛒">
          <SimpleChart
            labels={data.ordersTrend.slice(-10).map(d => fmtDate(d.date))}
            datasets={[{ data: data.ordersTrend.slice(-10).map(d => d.count || 0), color: () => COLORS.green, strokeWidth: 2 }]}
          />
        </SectionCard>
      )}
    </View>
  );
}

// ── Users Screen ──────────────────────────────────────────────────────────────
function UsersScreen({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const [ov, ug, seg, recent] = await Promise.allSettled([
          api.getOverview(),
          api.getUserGrowth(period),
          api.getUserSegmentation(),
          api.getRecentUsers(50),
        ]);
        setData({
          overview: ov.status === 'fulfilled' ? ov.value.data : {},
          growth: ug.status === 'fulfilled' ? ug.value.data : [],
          segmentation: seg.status === 'fulfilled' ? seg.value.data : {},
          recent: recent.status === 'fulfilled' ? recent.value.data : [],
        });
      } catch {}
      setLoading(false);
    })();
  });

  if (loading) return <Loader />;
  const ov = data?.overview || {};
  const seg = data?.segmentation || {};

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={cs.kpiGrid}>
        <KpiCard icon="👥" label="Total Users" value={ov.total_users} />
        <KpiCard icon="🛍️" label="Customers" value={ov.customers} />
        <KpiCard icon="🏪" label="Businesses" value={ov.businesses} />
        <KpiCard icon="🆕" label="New (30d)" value={ov.new_users_30d} />
      </View>

      {data?.growth?.length > 0 && (
        <SectionCard title="User Growth" icon="📈">
          <SimpleChart
            labels={data.growth.slice(-10).map(d => fmtDate(d.date))}
            datasets={[{ data: data.growth.slice(-10).map(d => d.count || 0) }]}
          />
        </SectionCard>
      )}

      {seg.segments && (
        <SectionCard title="User Segments" icon="🎯">
          {Object.entries(seg.segments || {}).map(([name, count]) => (
            <MiniBar key={name} label={name} data={count} maxVal={Math.max(...Object.values(seg.segments))} color={COLORS.purple} />
          ))}
        </SectionCard>
      )}

      {data?.recent?.length > 0 && (
        <SectionCard title="Recent Users" icon="🆕">
          {data.recent.slice(0, 15).map((u, i) => (
            <View key={i} style={cs.listRow}>
              <View style={[cs.avatar, { backgroundColor: [COLORS.primary, COLORS.purple, COLORS.green, COLORS.amber][i % 4] }]}>
                <Text style={cs.avatarText}>{(u.name || '?')[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle}>{u.name || 'Anonymous'}</Text>
                <Text style={cs.listRowSub}>{u.phone || u.email || 'No contact'} · {fmtDate(u.created_at)}</Text>
              </View>
              <Badge label={u.active_role || 'customer'} color={u.active_role === 'business' ? COLORS.purple : COLORS.primary} />
            </View>
          ))}
        </SectionCard>
      )}
    </View>
  );
}

// ── Shops Screen ──────────────────────────────────────────────────────────────
function ShopsScreen({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const [lb, cats, growth, health] = await Promise.allSettled([
          api.getShopLeaderboard('score', 50),
          api.getShopCategories(),
          api.getShopGrowth(period),
          api.getShopsHealth(),
        ]);
        setData({
          leaderboard: lb.status === 'fulfilled' ? lb.value.data : [],
          categories: cats.status === 'fulfilled' ? cats.value.data : [],
          growth: growth.status === 'fulfilled' ? growth.value.data : [],
          health: health.status === 'fulfilled' ? health.value.data : [],
        });
      } catch {}
      setLoading(false);
    })();
  });

  if (loading) return <Loader />;

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {data?.growth?.length > 0 && (
        <SectionCard title="Shop Growth" icon="📈">
          <SimpleChart
            labels={data.growth.slice(-10).map(d => fmtDate(d.date))}
            datasets={[{ data: data.growth.slice(-10).map(d => d.count || 0), color: () => COLORS.green }]}
          />
        </SectionCard>
      )}

      {data?.categories?.length > 0 && (
        <SectionCard title="Shop Categories" icon="📊">
          {data.categories.slice(0, 8).map((c, i) => (
            <MiniBar key={i} label={c.category || 'Other'} data={c.count} maxVal={Math.max(...data.categories.map(x => x.count))} color={[COLORS.primary, COLORS.purple, COLORS.green, COLORS.amber, COLORS.coral][i % 5]} />
          ))}
        </SectionCard>
      )}

      {data?.leaderboard?.length > 0 && (
        <SectionCard title="Top Shops" icon="🏆">
          {data.leaderboard.slice(0, 15).map((s, i) => (
            <View key={i} style={cs.listRow}>
              <View style={[cs.rankBadge, i < 3 && { backgroundColor: ['#FFD700', '#C0C0C0', '#CD7F32'][i] }]}>
                <Text style={cs.rankText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle}>{s.name}</Text>
                <Text style={cs.listRowSub}>{s.category} · {fmtNum(s.product_count)} products</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={cs.listRowValue}>{fmtINR(s.total_revenue || s.gmv || 0)}</Text>
                <Text style={cs.listRowSub}>Score: {s.score || 0}</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      )}

      {data?.health?.length > 0 && (
        <SectionCard title="Needs Attention" icon="⚠️">
          {data.health.slice(0, 10).map((s, i) => (
            <View key={i} style={[cs.listRow, { backgroundColor: '#FEF2F2' }]}>
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle}>{s.name}</Text>
                <Text style={[cs.listRowSub, { color: COLORS.red }]}>{s.reason || 'Low activity'}</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      )}
    </View>
  );
}

// ── Products Screen ───────────────────────────────────────────────────────────
function ProductsScreen({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const [cats, viewed, wishlisted, growth, ai] = await Promise.allSettled([
          api.getProductsByCategory(),
          api.getTopViewed(30),
          api.getTopWishlisted(30),
          api.getProductsGrowth(period),
          api.getAiStats(),
        ]);
        setData({
          categories: cats.status === 'fulfilled' ? cats.value.data : [],
          topViewed: viewed.status === 'fulfilled' ? viewed.value.data : [],
          topWishlisted: wishlisted.status === 'fulfilled' ? wishlisted.value.data : [],
          growth: growth.status === 'fulfilled' ? growth.value.data : [],
          aiStats: ai.status === 'fulfilled' ? ai.value.data : {},
        });
      } catch {}
      setLoading(false);
    })();
  });

  if (loading) return <Loader />;

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {data?.growth?.length > 0 && (
        <SectionCard title="Products Growth" icon="📈">
          <SimpleChart
            labels={data.growth.slice(-10).map(d => fmtDate(d.date))}
            datasets={[{ data: data.growth.slice(-10).map(d => d.count || 0), color: () => COLORS.purple }]}
          />
        </SectionCard>
      )}

      {data?.categories?.length > 0 && (
        <SectionCard title="By Category" icon="📊">
          {data.categories.slice(0, 8).map((c, i) => (
            <MiniBar key={i} label={c.category || 'Other'} data={c.count} maxVal={Math.max(...data.categories.map(x => x.count))} color={[COLORS.primary, COLORS.purple, COLORS.green, COLORS.amber][i % 4]} />
          ))}
        </SectionCard>
      )}

      {data?.topViewed?.length > 0 && (
        <SectionCard title="Most Viewed" icon="👁️">
          {data.topViewed.slice(0, 10).map((p, i) => (
            <View key={i} style={cs.listRow}>
              <Text style={cs.rankSmall}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle} numberOfLines={1}>{p.name}</Text>
                <Text style={cs.listRowSub}>{p.shop_name} · {fmtINR(p.price)}</Text>
              </View>
              <Text style={cs.listRowValue}>{fmtNum(p.view_count)} views</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {data?.topWishlisted?.length > 0 && (
        <SectionCard title="Most Wishlisted" icon="❤️">
          {data.topWishlisted.slice(0, 10).map((p, i) => (
            <View key={i} style={cs.listRow}>
              <Text style={cs.rankSmall}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle} numberOfLines={1}>{p.name}</Text>
                <Text style={cs.listRowSub}>{p.shop_name}</Text>
              </View>
              <Text style={cs.listRowValue}>{fmtNum(p.wishlist_count)}</Text>
            </View>
          ))}
        </SectionCard>
      )}
    </View>
  );
}

// ── Orders Screen ─────────────────────────────────────────────────────────────
function OrdersScreen({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const [ov, trend, funnel, recent] = await Promise.allSettled([
          api.getOverview(),
          api.getOrdersTrend(period),
          api.getOrderFunnel(),
          api.getRecentOrders(100),
        ]);
        setData({
          overview: ov.status === 'fulfilled' ? ov.value.data : {},
          trend: trend.status === 'fulfilled' ? trend.value.data : [],
          funnel: funnel.status === 'fulfilled' ? funnel.value.data : {},
          recent: recent.status === 'fulfilled' ? recent.value.data : [],
        });
      } catch {}
      setLoading(false);
    })();
  });

  if (loading) return <Loader />;
  const ov = data?.overview || {};
  const funnel = data?.funnel || {};

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={cs.kpiGrid}>
        <KpiCard icon="🛒" label="Total Orders" value={ov.total_orders} />
        <KpiCard icon="📦" label="This Week" value={ov.orders_7d} />
        <KpiCard icon="💰" label="GMV (Total)" value={ov.gmv_total} fmt="currency" />
        <KpiCard icon="📊" label="AOV" value={ov.avg_order_value} fmt="currency" />
      </View>

      {data?.trend?.length > 0 && (
        <SectionCard title="Orders Trend" icon="📈">
          <SimpleChart
            labels={data.trend.slice(-10).map(d => fmtDate(d.date))}
            datasets={[{ data: data.trend.slice(-10).map(d => d.count || 0), color: () => COLORS.green }]}
          />
        </SectionCard>
      )}

      {funnel && Object.keys(funnel).length > 0 && (
        <SectionCard title="Order Funnel" icon="🔻">
          {Object.entries(funnel).map(([status, count], i) => (
            <View key={status} style={cs.listRow}>
              <Badge label={status} color={STS_CLR[status.toLowerCase()] || COLORS.gray} />
              <View style={{ flex: 1 }} />
              <Text style={cs.listRowValue}>{fmtNum(count)}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {data?.recent?.length > 0 && (
        <SectionCard title="Recent Orders" icon="🕐">
          {data.recent.slice(0, 20).map((o, i) => (
            <View key={i} style={cs.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle}>#{o.id?.slice(0, 8)} · {o.customer_name || 'Customer'}</Text>
                <Text style={cs.listRowSub}>{o.shop_name} · {fmtDate(o.created_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={cs.listRowValue}>{fmtINR(o.total || o.total_amount)}</Text>
                <Badge label={o.status} color={STS_CLR[o.status?.toLowerCase()] || COLORS.gray} />
              </View>
            </View>
          ))}
        </SectionCard>
      )}
    </View>
  );
}

// ── Engagement Screen ─────────────────────────────────────────────────────────
function EngagementScreen({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const [features, searches, gaps, haggles, deals] = await Promise.allSettled([
          api.getFeatureUsage(),
          api.getTopSearches(20),
          api.getDemandGaps(15),
          api.getHaggleStats(),
          api.getDealPerformance(),
        ]);
        setData({
          features: features.status === 'fulfilled' ? features.value.data : [],
          searches: searches.status === 'fulfilled' ? searches.value.data : [],
          gaps: gaps.status === 'fulfilled' ? gaps.value.data : [],
          haggles: haggles.status === 'fulfilled' ? haggles.value.data : {},
          deals: deals.status === 'fulfilled' ? deals.value.data : {},
        });
      } catch {}
      setLoading(false);
    })();
  });

  if (loading) return <Loader />;

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {data?.features?.length > 0 && (
        <SectionCard title="Feature Usage" icon="📊">
          {data.features.slice(0, 10).map((f, i) => (
            <MiniBar key={i} label={f.feature || f.event_type} data={f.count} maxVal={Math.max(...data.features.map(x => x.count))} color={[COLORS.primary, COLORS.purple, COLORS.green, COLORS.amber, COLORS.coral][i % 5]} />
          ))}
        </SectionCard>
      )}

      {data?.searches?.length > 0 && (
        <SectionCard title="Top Searches" icon="🔍">
          {data.searches.slice(0, 15).map((s, i) => (
            <View key={i} style={cs.listRow}>
              <Text style={cs.rankSmall}>{i + 1}</Text>
              <Text style={[cs.listRowTitle, { flex: 1 }]}>{s.query}</Text>
              <Text style={cs.listRowValue}>{fmtNum(s.count)}</Text>
              {s.avg_results === 0 && <Text style={{ color: COLORS.red, fontSize: 11, marginLeft: 4 }}>0 results</Text>}
            </View>
          ))}
        </SectionCard>
      )}

      {data?.gaps?.length > 0 && (
        <SectionCard title="Unmet Demand" icon="🎯">
          {data.gaps.slice(0, 10).map((g, i) => (
            <View key={i} style={[cs.listRow, { backgroundColor: '#FEF2F2', borderRadius: 12 }]}>
              <View style={[cs.rankBadge, { backgroundColor: COLORS.red }]}>
                <Text style={[cs.rankText, { color: '#fff' }]}>{i + 1}</Text>
              </View>
              <Text style={[cs.listRowTitle, { flex: 1 }]}>{g.query}</Text>
              <Badge label={`${g.count} searches`} color={COLORS.red} />
            </View>
          ))}
        </SectionCard>
      )}

      {data?.haggles && typeof data.haggles === 'object' && Object.keys(data.haggles).length > 0 && (
        <SectionCard title="Haggle Stats" icon="🤝">
          <View style={cs.kpiGrid}>
            <KpiCard icon="💬" label="Total Haggles" value={data.haggles.total} />
            <KpiCard icon="✅" label="Accepted" value={data.haggles.accepted} />
            <KpiCard icon="❌" label="Rejected" value={data.haggles.rejected} />
          </View>
        </SectionCard>
      )}
    </View>
  );
}

// ── Financial Screen ──────────────────────────────────────────────────────────
function FinancialScreen({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const [coins] = await Promise.allSettled([
          api.getShopcoinsEconomy(period),
        ]);
        setData({
          shopcoins: coins.status === 'fulfilled' ? coins.value.data : {},
        });
      } catch {}
      setLoading(false);
    })();
  });

  if (loading) return <Loader />;
  const coins = data?.shopcoins || {};

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={cs.kpiGrid}>
        <KpiCard icon="🪙" label="Coins Earned" value={coins.total_earned} />
        <KpiCard icon="💸" label="Coins Spent" value={coins.total_spent} />
        <KpiCard icon="📊" label="In Circulation" value={coins.circulation} />
      </View>

      {coins.trend?.length > 0 && (
        <SectionCard title="ShopCoins Economy" icon="💰">
          <SimpleChart
            labels={coins.trend.slice(-10).map(d => fmtDate(d.date))}
            datasets={[
              { data: coins.trend.slice(-10).map(d => d.earned || 0), color: () => COLORS.green, strokeWidth: 2 },
              { data: coins.trend.slice(-10).map(d => d.spent || 0), color: () => COLORS.red, strokeWidth: 2 },
            ]}
          />
        </SectionCard>
      )}

      {!coins.total_earned && !coins.total_spent && (
        <EmptyState icon="🪙" title="No ShopCoins activity" sub="Coins data will appear once users earn or spend coins" />
      )}
    </View>
  );
}

// ── AI Usage Screen ───────────────────────────────────────────────────────────
function AiUsageScreen({ period }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    (async () => {
      try {
        const [ov, byFeat, byModel, trend, recent, hourly, topUsers, ranking, outcomes] = await Promise.allSettled([
          api.getAiOverview(period),
          api.getAiCostByFeature(period),
          api.getAiCostByModel(period),
          api.getAiDailyTrend(period),
          api.getAiRecentCalls(50),
          api.getAiHourlyDistribution(period),
          api.getAiTopUsers(period),
          api.getRankingDiagnostics(),
          api.getRankingOutcomes(period),
        ]);
        setData({
          overview: ov.status === 'fulfilled' ? ov.value.data : {},
          byFeature: byFeat.status === 'fulfilled' ? byFeat.value.data : [],
          byModel: byModel.status === 'fulfilled' ? byModel.value.data : [],
          trend: trend.status === 'fulfilled' ? trend.value.data : [],
          recent: recent.status === 'fulfilled' ? recent.value.data : [],
          hourly: hourly.status === 'fulfilled' ? hourly.value.data : [],
          topUsers: topUsers.status === 'fulfilled' ? topUsers.value.data : [],
          ranking: ranking.status === 'fulfilled' ? ranking.value.data : null,
          outcomes: outcomes.status === 'fulfilled' ? outcomes.value.data : null,
        });
      } catch {}
      setLoading(false);
    })();
  });

  if (loading) return <Loader />;
  const ov = data?.overview || {};

  if (!ov.total_calls && ov.total_calls !== 0) {
    return <EmptyState icon="🤖" title="Loading AI data..." />;
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={cs.kpiGrid}>
        <KpiCard icon="📞" label="API Calls" value={ov.total_calls} sub={`${ov.error_count || 0} errors`} />
        <KpiCard icon="🪙" label="Total Tokens" value={ov.total_tokens} />
        <KpiCard icon="💵" label="Total Cost" value={ov.total_cost_usd} fmt="usd" />
        <KpiCard icon="⚡" label="Avg Latency" value={ov.avg_response_ms} sub={`${ov.unique_users || 0} users`} />
      </View>

      {data?.ranking?.report_available && (
        <>
          <View style={cs.kpiGrid}>
            <KpiCard icon="🎯" label="Content P@5" value={(data.ranking.summary?.content_avg_precision_at_5 || 0) * 100} sub={data.ranking.summary?.best_surface?.replace(/_/g, ' ')} />
            <KpiCard icon="🤝" label="Collab P@5" value={(data.ranking.summary?.collaborative_avg_precision_at_5 || 0) * 100} />
            <KpiCard icon="🔎" label="Unified P@5" value={(data.ranking.summary?.unified_avg_precision_at_5 || 0) * 100} sub={`${data.ranking.summary?.avg_unified_shop_coverage || 0} shops`} />
            <KpiCard icon="🕒" label="Freshness (hrs)" value={data.ranking.freshness?.age_hours || 0} sub={data.ranking.freshness?.status || 'unknown'} />
          </View>

          <SectionCard title="Ranking Diagnostics" icon="🧭">
            <View style={{ gap: 10 }}>
              <View style={cs.listRow}>
                <Text style={cs.listRowTitle}>Version</Text>
                <Badge label={data.ranking.version} color={COLORS.primary} />
              </View>
              {data.ranking.active_profile?.label ? (
                <View style={cs.listRow}>
                  <Text style={cs.listRowTitle}>Active Profile</Text>
                  <Badge label={data.ranking.active_profile.label} color={COLORS.green} />
                </View>
              ) : null}
              <View style={cs.listRow}>
                <Text style={cs.listRowTitle}>Personas Evaluated</Text>
                <Text style={cs.listRowValue}>{fmtNum(data.ranking.summary?.persona_count || 0)}</Text>
              </View>
              <View style={cs.listRow}>
                <Text style={cs.listRowTitle}>Best Surface</Text>
                <Badge label={(data.ranking.summary?.best_surface || '').replace(/_/g, ' ')} color={COLORS.purple} />
              </View>
              {(data.ranking.personas || []).slice(0, 3).map((item) => (
                <View key={item.persona} style={[cs.listRow, { alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={cs.listRowTitle}>{item.persona}</Text>
                    <Text style={cs.listRowSub}>
                      Content {fmtPct(item.content_precision_at_5 * 100)} · Unified {fmtPct(item.unified_precision_at_5 * 100)}
                    </Text>
                  </View>
                  <Text style={cs.listRowValue}>{item.unified_shop_count} shops</Text>
                </View>
              ))}
              {(data.ranking.available_profiles || []).length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {data.ranking.available_profiles.map((profile) => (
                    <Badge key={profile.id} label={profile.label} color={profile.active ? COLORS.green : COLORS.gray} />
                  ))}
                </View>
              ) : null}
              {Object.keys(data.ranking.surface_profiles || {}).length > 0 ? (
                <View style={[cs.sectionCard, { backgroundColor: '#F9FAFB', padding: 12 }]}>
                  <Text style={[cs.sectionTitle, { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', color: '#6B7280' }]}>
                    Surface Profiles
                  </Text>
                  {Object.entries(data.ranking.surface_profiles).map(([surface, profile]) => (
                    <View key={surface} style={cs.listRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={cs.listRowTitle}>{surface.replace(/_/g, ' ')}</Text>
                      </View>
                      <Badge label={profile.label} color={profile.overridden ? COLORS.purple : COLORS.gray} />
                    </View>
                  ))}
                </View>
              ) : null}
              {Object.keys(data.ranking.surface_experiments || {}).length > 0 ? (
                <View style={[cs.sectionCard, { backgroundColor: '#F9FAFB', padding: 12 }]}>
                  <Text style={[cs.sectionTitle, { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', color: '#6B7280' }]}>
                    Surface Experiments
                  </Text>
                  {Object.entries(data.ranking.surface_experiments).map(([surface, experiment]) => (
                    <View key={surface} style={[cs.listRow, { alignItems: 'flex-start' }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={cs.listRowTitle}>{surface.replace(/_/g, ' ')}</Text>
                        <Text style={cs.listRowSub}>{experiment.experiment_id}</Text>
                        <Text style={[cs.listRowSub, { marginTop: 4 }]}>
                          {experiment.variants.map((variant) => `${variant.label} ${Math.round((variant.weight || 0) * 100)}%`).join(' · ')}
                        </Text>
                      </View>
                      <Badge label={`${experiment.variants.length} vars`} color={COLORS.amber} />
                    </View>
                  ))}
                </View>
              ) : null}
              {(data.ranking.history || []).length > 0 ? (
                <View style={[cs.sectionCard, { backgroundColor: '#F9FAFB', padding: 12 }]}>
                  <Text style={[cs.sectionTitle, { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', color: '#6B7280' }]}>
                    Recent Ranking Changes
                  </Text>
                  {data.ranking.history.slice(0, 5).map((item, index) => (
                    <View key={`${item.created_at}-${index}`} style={cs.listRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={cs.listRowTitle}>{item.event_type.replace(/_/g, ' ')}</Text>
                        <Text style={cs.listRowSub}>
                          {[item.surface, item.experiment_id, item.profile_id || item.winner_profile_id].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Text style={cs.listRowSub}>{fmtDate(item.created_at)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </SectionCard>
        </>
      )}

      {data?.outcomes?.summary?.surface_count > 0 && (
        <>
          <View style={cs.kpiGrid}>
            <KpiCard icon="👀" label="Impressions" value={data.outcomes.summary?.impressions || 0} />
            <KpiCard icon="🖱️" label="CTR" value={data.outcomes.summary?.ctr || 0} fmt="pct" />
            <KpiCard icon="🛒" label="ATC Rate" value={data.outcomes.summary?.add_to_cart_rate || 0} fmt="pct" />
            <KpiCard icon="💳" label="Purchase Rate" value={data.outcomes.summary?.purchase_rate || 0} fmt="pct" sub={(data.outcomes.summary?.best_surface || '').replace(/_/g, ' ')} />
          </View>

          <SectionCard title="Ranking Outcomes" icon="📈">
            {(data.outcomes.experiments || []).length > 0 ? (
              <View style={[cs.sectionCard, { backgroundColor: '#F9FAFB', padding: 12, marginBottom: 12 }]}>
                <Text style={[cs.sectionTitle, { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', color: '#6B7280' }]}>
                  Experiment Outcomes
                </Text>
                {data.outcomes.experiments.map((experiment) => (
                  <View key={experiment.experiment_id} style={[cs.listRow, { alignItems: 'flex-start' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={cs.listRowTitle}>{experiment.experiment_id}</Text>
                      <Text style={cs.listRowSub}>
                        {experiment.surface.replace(/_/g, ' ')} · {fmtNum(experiment.impressions)} impressions · CTR {fmtPct(experiment.ctr)} · Purchase {fmtPct(experiment.purchase_rate)}
                      </Text>
                      <Text style={[cs.listRowSub, { marginTop: 4 }]}>
                        {experiment.variants.map((variant) => `${variant.variant_id}: ${fmtPct(variant.ctr)} CTR`).join(' · ')}
                      </Text>
                    </View>
                    <Badge label={`${experiment.variants.length} vars`} color={COLORS.amber} />
                  </View>
                ))}
              </View>
            ) : null}
            {(data.outcomes.surfaces || []).map((row) => (
              <View key={row.surface} style={[cs.listRow, { alignItems: 'flex-start' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={cs.listRowTitle}>{row.label}</Text>
                  <Text style={cs.listRowSub}>
                    {fmtNum(row.impressions)} impressions · CTR {fmtPct(row.ctr)} · ATC {fmtPct(row.add_to_cart_rate)} · Purchase {fmtPct(row.purchase_rate)}
                  </Text>
                  {row.top_reasons?.[0] ? (
                    <Text style={[cs.listRowSub, { marginTop: 2 }]}>Top reason: {row.top_reasons[0].reason}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </SectionCard>
        </>
      )}

      {/* Daily Trend */}
      {data?.trend?.length > 0 && (
        <SectionCard title="Daily API Usage" icon="📈">
          <SimpleChart
            labels={data.trend.slice(-10).map(d => fmtDate(d.date))}
            datasets={[{ data: data.trend.slice(-10).map(d => d.calls || 0), color: () => COLORS.primary, strokeWidth: 2 }]}
          />
        </SectionCard>
      )}

      {/* Cost by Feature */}
      {data?.byFeature?.length > 0 && (
        <SectionCard title="Cost by Feature" icon="🧩">
          {data.byFeature.map((f, i) => (
            <View key={i} style={cs.listRow}>
              <View style={[cs.dot, { backgroundColor: [COLORS.primary, COLORS.purple, COLORS.green, COLORS.amber, COLORS.coral, COLORS.pink][i % 6] }]} />
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle}>{f.feature?.replace(/_/g, ' ')}</Text>
                <Text style={cs.listRowSub}>{fmtNum(f.calls)} calls · {fmtNum(f.tokens)} tokens</Text>
              </View>
              <Text style={[cs.listRowValue, { color: COLORS.primary }]}>{fmtUSD(f.cost_usd)}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* Cost by Model */}
      {data?.byModel?.length > 0 && (
        <SectionCard title="Usage by Model" icon="🧠">
          {data.byModel.map((m, i) => (
            <View key={i} style={[cs.listRow, { backgroundColor: '#F3F4F6', borderRadius: 12 }]}>
              <View style={[cs.dot, { backgroundColor: [COLORS.primary, COLORS.purple, COLORS.green][i % 3] }]} />
              <View style={{ flex: 1 }}>
                <Text style={[cs.listRowTitle, { fontWeight: '700' }]}>{m.model}</Text>
                <Text style={cs.listRowSub}>
                  {fmtNum(m.calls)} calls · {fmtNum(m.prompt_tokens)} in / {fmtNum(m.completion_tokens)} out
                </Text>
              </View>
              <Text style={[cs.listRowValue, { fontWeight: '800' }]}>{fmtUSD(m.cost_usd)}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* Hourly Distribution */}
      {data?.hourly?.length > 0 && (
        <SectionCard title="Peak Hours" icon="🕐">
          <SimpleBarChart
            labels={data.hourly.slice(0, 12).map(h => `${h.hour}h`)}
            data={data.hourly.slice(0, 12).map(h => h.calls || 0)}
            color={COLORS.primary}
            height={180}
          />
        </SectionCard>
      )}

      {/* Top AI Users */}
      {data?.topUsers?.length > 0 && (
        <SectionCard title="Top AI Users" icon="👤">
          {data.topUsers.slice(0, 10).map((u, i) => (
            <View key={i} style={cs.listRow}>
              <View style={[cs.avatar, { backgroundColor: [COLORS.primary, COLORS.purple, COLORS.green, COLORS.amber][i % 4] }]}>
                <Text style={cs.avatarText}>{(u.name || '?')[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle}>{u.name}</Text>
                <Text style={cs.listRowSub}>{fmtNum(u.calls)} calls · {fmtNum(u.tokens)} tokens</Text>
              </View>
              <Text style={[cs.listRowValue, { fontWeight: '800' }]}>{fmtUSD(u.cost_usd)}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* Recent Calls */}
      {data?.recent?.length > 0 && (
        <SectionCard title="Recent API Calls" icon="📋">
          {data.recent.slice(0, 20).map((call, i) => (
            <View key={i} style={cs.listRow}>
              <View style={[cs.dot, { backgroundColor: call.status === 'success' ? COLORS.green : COLORS.red }]} />
              <View style={{ flex: 1 }}>
                <Text style={cs.listRowTitle}>{call.feature?.replace(/_/g, ' ')}{call.has_image ? ' 📷' : ''}</Text>
                <Text style={cs.listRowSub}>{call.model} · {fmtNum(call.total_tokens)} tokens · {call.response_time_ms}ms</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={cs.listRowValue}>{fmtUSD(call.cost_usd)}</Text>
                <Text style={[cs.listRowSub, { fontSize: 10 }]}>{fmtDate(call.created_at)}</Text>
              </View>
            </View>
          ))}
        </SectionCard>
      )}

      {ov.total_calls === 0 && (
        <EmptyState icon="🤖" title="No AI calls yet" sub="Usage data will appear as users interact with AI features" />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  authBlock: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  authSub: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
  },
  authBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  authBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  periodRow: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 3 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  periodBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  periodText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  periodTextActive: { color: '#111827' },
  tabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', maxHeight: 52 },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginVertical: 6,
  },
  tabActive: { backgroundColor: '#3B8BD4' },
  tabIcon: { fontSize: 14 },
  tabLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#fff' },
  content: { flex: 1 },
});

const cs = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: (SCREEN_W - 42) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  kpiIcon: { fontSize: 28 },
  kpiValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  kpiLabel: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  kpiSub: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  listRowTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  listRowSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  listRowValue: { fontSize: 13, fontWeight: '700', color: '#374151' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: { fontSize: 11, fontWeight: '800', color: '#374151' },
  rankSmall: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', width: 20, textAlign: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  miniBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  miniBarLabel: { width: 80, fontSize: 11, color: '#374151', fontWeight: '500' },
  miniBarTrack: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  miniBarFill: { height: 8, borderRadius: 4 },
  miniBarValue: { width: 45, fontSize: 11, fontWeight: '700', color: '#374151', textAlign: 'right' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  loader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
});
