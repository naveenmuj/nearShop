TEMPLATES: dict[str, dict[str, str]] = {
    "order_confirmed": {
        "title": "Order Confirmed",
        "body": "Your order {order_number} has been confirmed by {shop_name}",
    },
    "order_ready": {
        "title": "Order Ready",
        "body": "Your order {order_number} is ready for pickup at {shop_name}",
    },
    "order_delivered": {
        "title": "Order Delivered",
        "body": "Your order {order_number} has been delivered",
    },
    "order_cancelled": {
        "title": "Order Cancelled",
        "body": "Your order {order_number} has been cancelled",
    },
    "new_order": {
        "title": "New Order!",
        "body": "You have a new order {order_number}",
    },
    "haggle_offer": {
        "title": "New Price Offer",
        "body": "{customer_name} made an offer on {product_name}",
    },
    "haggle_counter_offer": {
        "title": "Counter-Offer Received",
        "body": "Counter-offer received on your haggle for {product_name}",
    },
    "haggle_accepted": {
        "title": "Offer Accepted!",
        "body": "Your offer on {product_name} was accepted",
    },
    "haggle_rejected": {
        "title": "Offer Declined",
        "body": "Your offer on {product_name} was declined",
    },
    "deal_expiring": {
        "title": "Deal Ending Soon",
        "body": "'{deal_title}' expires in 1 hour",
    },
    "price_drop": {
        "title": "Price Drop!",
        "body": "{product_name} dropped to \u20b9{new_price}",
    },
    "reservation_confirmed": {
        "title": "Item Reserved",
        "body": "{product_name} is held for you at {shop_name}",
    },
    "reservation_expiring": {
        "title": "Reservation Expiring",
        "body": "Your reservation for {product_name} expires in 30 minutes",
    },
    "new_review": {
        "title": "New Review",
        "body": "{customer_name} left a {rating}\u2605 review",
    },
    "coins_earned": {
        "title": "ShopCoins Earned!",
        "body": "You earned {amount} ShopCoins for {reason}",
    },
    "badge_earned": {
        "title": "New Badge!",
        "body": "You earned the {badge_name} badge!",
    },
    "new_follower": {
        "title": "New Follower",
        "body": "{user_name} started following your shop",
    },
    "new_message": {
        "title": "New Message",
        "body": "{party_name}: {message_preview}",
    },
}
