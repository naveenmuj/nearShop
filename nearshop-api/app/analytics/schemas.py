from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


ConfidenceLevel = Literal["low", "medium", "high"]


class InsightMethods(BaseModel):
    forecasting: str
    inventory_alerts: str
    customer_segments: str
    demand_snapshot: str


class InsightSampleSizes(BaseModel):
    orders_last_30_days: int
    revenue_last_30_days: float
    active_stocked_products: int
    customers_segmented: int
    demand_queries: int


class InsightConfidence(BaseModel):
    forecast: ConfidenceLevel
    segments: ConfidenceLevel
    demand: ConfidenceLevel


class InsightsMeta(BaseModel):
    generated_at: datetime
    analysis_window_days: int
    forecast_horizon_days: int
    location_applied: bool
    methods: InsightMethods
    sample_sizes: InsightSampleSizes
    confidence: InsightConfidence
    warnings: list[str]


class SalesSeriesPoint(BaseModel):
    date: str
    value: float | int


class SalesForecast(BaseModel):
    next_7_days_revenue: float
    next_7_days_orders: int
    recent_daily_avg_revenue: float
    recent_daily_avg_orders: float
    revenue_trend_pct: Optional[float] = None
    orders_trend_pct: Optional[float] = None
    daily_revenue_last_30_days: list[SalesSeriesPoint]
    daily_orders_last_30_days: list[SalesSeriesPoint]


class ReorderAlert(BaseModel):
    product_id: str
    product_name: str
    category: Optional[str] = None
    stock_quantity: int
    low_stock_threshold: int
    sold_last_30_days: int
    daily_sales_velocity: float
    days_left: Optional[float] = None
    recommended_reorder_qty: int
    severity: Literal["high", "medium"]
    estimated_revenue_at_risk: float


class CustomerSegmentsPayload(BaseModel):
    summary: dict
    segments: dict
    customers: list[dict]


class DemandInsight(BaseModel):
    query: str
    count: int


class RecommendedAction(BaseModel):
    id: str
    type: str
    priority: Literal["low", "medium", "high"]
    title: str
    description: str
    cta_label: str
    target: str
    highlights: list[str]


class OperationalInsightsResponse(BaseModel):
    shop_id: str
    meta: InsightsMeta
    sales_forecast: SalesForecast
    reorder_alerts: list[ReorderAlert]
    customer_segments: CustomerSegmentsPayload
    demand_snapshot: list[DemandInsight]
    recommended_actions: list[RecommendedAction]

    model_config = ConfigDict(from_attributes=True)
