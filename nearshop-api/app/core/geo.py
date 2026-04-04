import math

from sqlalchemy.sql import func


def haversine_distance_km(lat1: float, lng1: float, lat2_col, lng2_col):
    """SQLAlchemy expression for Haversine distance in km."""
    lat1_r = math.radians(lat1)
    lng1_r = math.radians(lng1)
    lat2_r = func.radians(lat2_col)
    lng2_r = func.radians(lng2_col)

    dlat = lat2_r - lat1_r
    dlng = lng2_r - lng1_r

    a = func.pow(func.sin(dlat / 2), 2) + \
        math.cos(lat1_r) * func.cos(lat2_r) * func.pow(func.sin(dlng / 2), 2)
    c = 2 * func.asin(func.sqrt(a))
    return 6371 * c  # Earth radius in km


def within_radius(lat_col, lng_col, center_lat: float, center_lng: float, radius_km: float):
    """SQLAlchemy WHERE clause for within radius using Haversine."""
    dist = haversine_distance_km(center_lat, center_lng, lat_col, lng_col)
    return dist <= radius_km


def haversine_distance_km_value(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Pure Python Haversine distance in km for numeric latitude/longitude values."""
    lat1_r = math.radians(lat1)
    lng1_r = math.radians(lng1)
    lat2_r = math.radians(lat2)
    lng2_r = math.radians(lng2)

    dlat = lat2_r - lat1_r
    dlng = lng2_r - lng1_r

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlng / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return 6371 * c
