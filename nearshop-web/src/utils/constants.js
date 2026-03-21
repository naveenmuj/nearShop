export const CATEGORIES = [
  { id: 'electronics', name: 'Electronics', icon: '📱' },
  { id: 'clothing', name: 'Clothing', icon: '👕' },
  { id: 'grocery', name: 'Grocery', icon: '🛒' },
  { id: 'food', name: 'Food & Dining', icon: '🍽️' },
  { id: 'home', name: 'Home & Living', icon: '🏠' },
  { id: 'beauty', name: 'Beauty', icon: '💄' },
  { id: 'health', name: 'Health', icon: '💊' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'books', name: 'Books', icon: '📚' },
  { id: 'toys', name: 'Toys', icon: '🧸' },
  { id: 'automotive', name: 'Automotive', icon: '🚗' },
  { id: 'services', name: 'Services', icon: '🔧' },
]

export const ORDER_STATUSES = {
  pending: { label: 'Pending', color: 'warning' },
  confirmed: { label: 'Confirmed', color: 'primary' },
  preparing: { label: 'Preparing', color: 'primary' },
  ready: { label: 'Ready', color: 'success' },
  completed: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'danger' },
}
