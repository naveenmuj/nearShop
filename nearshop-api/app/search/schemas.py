from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional, Any


class UnifiedSearchResponse(BaseModel):
    """Unified search result."""
    products: list[dict] = []
    shops: list[dict] = []


class SearchSuggestion(BaseModel):
    """A single search suggestion."""
    id: str
    type: str  # "product" or "shop"
    name: str
    category: Optional[str] = None
    price: Optional[float] = None  # For products
    distance_text: Optional[str] = None  # For shops
    icon: str


class SearchSuggestionsResponse(BaseModel):
    """Search suggestions response."""
    suggestions: list[SearchSuggestion]
