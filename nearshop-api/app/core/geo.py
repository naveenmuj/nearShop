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
