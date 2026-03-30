import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User, OTPCode, Follow, UserEvent, SearchLog
from app.auth.schemas import CompleteProfileRequest, UserResponse
from app.core.exceptions import BadRequestError, NotFoundError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    generate_otp,
    generate_referral_code,
    validate_phone,
)

logger = logging.getLogger(__name__)


class AuthService:

    @staticmethod
    async def send_otp(db: AsyncSession, phone: str) -> dict:
        validated_phone = validate_phone(phone)

        code = generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

        otp = OTPCode(
            phone=validated_phone,
            code=code,
            expires_at=expires_at,
        )
        db.add(otp)
        await db.flush()

        # In production, send via SMS gateway. For now, log to console.
        logger.info("OTP for %s: %s", validated_phone, code)
        print(f"[OTP] {validated_phone}: {code}")

        return {"message": "OTP sent successfully", "phone": validated_phone}

    @staticmethod
    async def verify_otp(db: AsyncSession, phone: str, code: str) -> dict:
        validated_phone = validate_phone(phone)

        # Fetch the latest OTP for this phone
        result = await db.execute(
            select(OTPCode)
            .where(OTPCode.phone == validated_phone)
            .order_by(OTPCode.created_at.desc())
            .limit(1)
        )
        otp_record = result.scalar_one_or_none()

        if otp_record is None:
            raise BadRequestError("No OTP found for this phone number. Request a new one.")

        # Check max attempts
        if otp_record.attempts >= 3:
            raise BadRequestError("Maximum OTP attempts exceeded. Request a new OTP.")

        # Increment attempts
        otp_record.attempts += 1
        await db.flush()

        # Check expiry
        now = datetime.now(timezone.utc)
        if otp_record.expires_at.tzinfo is None:
            expires = otp_record.expires_at.replace(tzinfo=timezone.utc)
        else:
            expires = otp_record.expires_at

        if now > expires:
            raise BadRequestError("OTP has expired. Request a new one.")

        # Validate code
        if otp_record.code != code:
            remaining = 3 - otp_record.attempts
            raise BadRequestError(
                f"Invalid OTP. {remaining} attempt(s) remaining."
            )

        # OTP is valid — delete it
        db.delete(otp_record)
        await db.flush()

        # Find or create user
        user_result = await db.execute(
            select(User).where(User.phone == validated_phone)
        )
        user = user_result.scalar_one_or_none()
        is_new_user = False

        if user is None:
            is_new_user = True
            referral = generate_referral_code()
            user = User(
                phone=validated_phone,
                referral_code=referral,
            )
            db.add(user)
            await db.flush()
            await db.refresh(user)

        # Generate tokens
        token_data = {"sub": str(user.id), "role": user.active_role}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user,
            "is_new_user": is_new_user,
        }

    @staticmethod
    async def refresh_token(db: AsyncSession, refresh_token_str: str) -> dict:
        payload = verify_refresh_token(refresh_token_str)

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Invalid token payload")

        result = await db.execute(
            select(User).where(User.id == UUID(user_id))
        )
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")
        if not user.is_active:
            raise UnauthorizedError("User account is deactivated")

        token_data = {"sub": str(user.id), "role": user.active_role}
        access_token = create_access_token(token_data)
        new_refresh_token = create_refresh_token(token_data)

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "user": user,
        }

    @staticmethod
    async def complete_profile(
        db: AsyncSession, user_id: UUID, data: CompleteProfileRequest
    ) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        user.name = data.name

        # Add role to roles array if not already present
        current_roles = list(user.roles or [])
        if data.role not in current_roles:
            current_roles.append(data.role)
            user.roles = current_roles

        user.active_role = data.role

        if data.interests is not None:
            user.interests = data.interests

        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def switch_role(db: AsyncSession, user_id: UUID, role: str) -> dict:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        # Auto-add customer role if not present (business users can also be customers)
        if role == 'customer' and role not in (user.roles or []):
            current_roles = list(user.roles or [])
            current_roles.append('customer')
            user.roles = current_roles
            await db.flush()

        if role not in (user.roles or []):
            raise BadRequestError(
                f"Role '{role}' is not available. Your roles: {user.roles}"
            )

        user.active_role = role
        await db.flush()
        await db.refresh(user)
        token_data = {"sub": str(user.id), "role": user.active_role}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": user,
        }

    @staticmethod
    async def update_profile(db: AsyncSession, user_id: UUID, data) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")
        if data.name is not None:
            user.name = data.name.strip()
        if data.phone is not None and data.phone.strip() and not user.phone:
            user.phone = data.phone.strip()
        if data.avatar_url is not None:
            user.avatar_url = data.avatar_url
        if data.interests is not None:
            user.interests = data.interests
        await db.flush()
        await db.refresh(user)
        return user

    @staticmethod
    async def get_user(db: AsyncSession, user_id: UUID) -> User:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if user is None:
            raise NotFoundError("User not found")

        return user

    @staticmethod
    async def delete_account(
        db: AsyncSession,
        user_id: UUID,
        delete_customer: bool = True,
        delete_business: bool = False,
    ) -> dict:
        """
        Delete user account and all associated data.
        If both delete_customer and delete_business are True, deletes everything
        including the user record and Firebase account.
        If only delete_business, removes shops and business data but keeps user.
        """
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise NotFoundError("User not found")

        firebase_uid = user.firebase_uid
        deleted_items = []

        # --- Delete business data (shops + related) ---
        if delete_business:
            from app.shops.models import Shop
            from app.products.models import Product, Wishlist, PriceHistory
            from app.orders.models import Order
            from app.reviews.models import Review
            from app.deals.models import Deal
            from app.stories.models import Story
            from app.billing.models import Bill
            from app.delivery.models import DeliveryZone
            from app.inventory.models import StockLog
            from app.broadcast.models import BroadcastMessage
            from app.expenses.models import Expense
            from app.haggle.models import HaggleSession, HaggleMessage

            # Get all shops owned by this user
            shops_result = await db.execute(
                select(Shop).where(Shop.owner_id == user_id)
            )
            shops = shops_result.scalars().all()
            shop_ids = [s.id for s in shops]

            if shop_ids:
                # Get all product IDs for these shops
                prod_result = await db.execute(
                    select(Product.id).where(Product.shop_id.in_(shop_ids))
                )
                product_ids = [r[0] for r in prod_result.all()]

                if product_ids:
                    # Delete product-related data
                    await db.execute(delete(PriceHistory).where(PriceHistory.product_id.in_(product_ids)))
                    await db.execute(delete(StockLog).where(StockLog.product_id.in_(product_ids)))
                    await db.execute(delete(Wishlist).where(Wishlist.product_id.in_(product_ids)))
                    await db.execute(delete(Product).where(Product.id.in_(product_ids)))

                # Delete shop-related data
                await db.execute(delete(DeliveryZone).where(DeliveryZone.shop_id.in_(shop_ids)))
                await db.execute(delete(Deal).where(Deal.shop_id.in_(shop_ids)))
                await db.execute(delete(Story).where(Story.shop_id.in_(shop_ids)))
                await db.execute(delete(Bill).where(Bill.shop_id.in_(shop_ids)))
                await db.execute(delete(BroadcastMessage).where(BroadcastMessage.shop_id.in_(shop_ids)))
                await db.execute(delete(Expense).where(Expense.shop_id.in_(shop_ids)))
                await db.execute(delete(Review).where(Review.shop_id.in_(shop_ids)))
                await db.execute(delete(Order).where(Order.shop_id.in_(shop_ids)))

                # Delete haggle sessions for these shops
                haggle_result = await db.execute(
                    select(HaggleSession.id).where(HaggleSession.shop_id.in_(shop_ids))
                )
                haggle_ids = [r[0] for r in haggle_result.all()]
                if haggle_ids:
                    await db.execute(delete(HaggleMessage).where(HaggleMessage.session_id.in_(haggle_ids)))
                    await db.execute(delete(HaggleSession).where(HaggleSession.id.in_(haggle_ids)))

                await db.execute(delete(Follow).where(Follow.shop_id.in_(shop_ids)))

                # Delete shops
                await db.execute(delete(Shop).where(Shop.id.in_(shop_ids)))
                deleted_items.append(f"{len(shop_ids)} shop(s)")

            # Remove business role
            if not delete_customer:
                roles = list(user.roles or [])
                if "business" in roles:
                    roles.remove("business")
                user.roles = roles if roles else ["customer"]
                user.active_role = "customer"
                await db.flush()

        # --- Delete customer data ---
        if delete_customer:
            from app.products.models import Wishlist
            from app.orders.models import Order
            from app.reviews.models import Review
            from app.loyalty.models import ShopCoinsLedger, Badge, UserStreak
            from app.engagement.models import (
                UserRecentlyViewed, UserRecentSearch,
                UserAchievement, DailySpin,
            )
            from app.notifications.models import Notification
            from app.community.models import CommunityPost, CommunityAnswer
            from app.reservations.models import Reservation
            from app.haggle.models import HaggleSession, HaggleMessage

            # Delete customer engagement data
            await db.execute(delete(UserRecentlyViewed).where(UserRecentlyViewed.user_id == user_id))
            await db.execute(delete(UserRecentSearch).where(UserRecentSearch.user_id == user_id))
            await db.execute(delete(UserAchievement).where(UserAchievement.user_id == user_id))
            await db.execute(delete(DailySpin).where(DailySpin.user_id == user_id))
            await db.execute(delete(Notification).where(Notification.user_id == user_id))
            await db.execute(delete(Wishlist).where(Wishlist.user_id == user_id))
            await db.execute(delete(ShopCoinsLedger).where(ShopCoinsLedger.user_id == user_id))
            await db.execute(delete(Badge).where(Badge.user_id == user_id))
            await db.execute(delete(UserStreak).where(UserStreak.user_id == user_id))
            await db.execute(delete(Follow).where(Follow.user_id == user_id))
            await db.execute(delete(Review).where(Review.user_id == user_id))
            await db.execute(delete(Reservation).where(Reservation.customer_id == user_id))
            await db.execute(delete(CommunityAnswer).where(CommunityAnswer.user_id == user_id))
            await db.execute(delete(CommunityPost).where(CommunityPost.user_id == user_id))
            await db.execute(delete(SearchLog).where(SearchLog.user_id == user_id))
            await db.execute(delete(UserEvent).where(UserEvent.user_id == user_id))

            # Delete customer haggle sessions
            cust_haggle = await db.execute(
                select(HaggleSession.id).where(HaggleSession.customer_id == user_id)
            )
            cust_haggle_ids = [r[0] for r in cust_haggle.all()]
            if cust_haggle_ids:
                await db.execute(delete(HaggleMessage).where(HaggleMessage.session_id.in_(cust_haggle_ids)))
                await db.execute(delete(HaggleSession).where(HaggleSession.id.in_(cust_haggle_ids)))

            # Delete customer orders (nullify customer_id or delete)
            await db.execute(delete(Order).where(Order.customer_id == user_id))
            deleted_items.append("customer data")

        # --- If both roles deleted, delete the user record + Firebase ---
        if delete_customer and delete_business:
            # Clear referral references from other users
            await db.execute(
                update(User).where(User.referred_by == user_id).values(referred_by=None)
            )
            # Delete OTP codes
            if user.phone:
                await db.execute(delete(OTPCode).where(OTPCode.phone == user.phone))

            # Delete the user record
            await db.execute(delete(User).where(User.id == user_id))
            deleted_items.append("user account")

            # Delete from Firebase
            if firebase_uid:
                try:
                    from firebase_admin import auth as firebase_auth
                    from app.core.firebase import get_firebase_app
                    get_firebase_app()
                    firebase_auth.delete_user(firebase_uid)
                    deleted_items.append("Firebase account")
                    logger.info("Deleted Firebase user %s", firebase_uid)
                except Exception as e:
                    logger.warning("Failed to delete Firebase user %s: %s", firebase_uid, e)

            await db.flush()
            return {"message": "Account permanently deleted", "deleted": deleted_items}

        elif delete_customer and not delete_business:
            # Remove customer role, keep business
            roles = list(user.roles or [])
            if "customer" in roles:
                roles.remove("customer")
            user.roles = roles if roles else ["business"]
            user.active_role = "business"
            await db.flush()

        await db.flush()
        return {"message": "Selected data deleted", "deleted": deleted_items}
