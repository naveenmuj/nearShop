from uuid import UUID
from typing import Dict, Set
import json
import asyncio
import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db, get_async_session
from app.auth.models import User
from app.auth.permissions import get_current_user, require_business, require_customer
from app.haggle.schemas import (
    StartHaggleRequest,
    HaggleOfferRequest,
    HaggleSessionResponse,
    HaggleListResponse,
)
from app.haggle.service import (
    start_haggle,
    send_offer,
    accept_haggle,
    reject_haggle,
    get_customer_haggles,
    get_shop_haggles,
)
from app.core.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/haggle", tags=["haggle"])


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET CONNECTION MANAGER FOR REAL-TIME HAGGLE
# ═══════════════════════════════════════════════════════════════════════════════

class HaggleConnectionManager:
    """Manages WebSocket connections for real-time haggle chat."""
    
    def __init__(self):
        # Map session_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Map user_id -> set of session_ids they're connected to
        self.user_sessions: Dict[str, Set[str]] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str, user_id: str):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        
        if session_id not in self.active_connections:
            self.active_connections[session_id] = set()
        self.active_connections[session_id].add(websocket)
        
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = set()
        self.user_sessions[user_id].add(session_id)
        
        logger.info(f"User {user_id} connected to haggle session {session_id}")
    
    def disconnect(self, websocket: WebSocket, session_id: str, user_id: str):
        """Remove a WebSocket connection."""
        if session_id in self.active_connections:
            self.active_connections[session_id].discard(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        
        if user_id in self.user_sessions:
            self.user_sessions[user_id].discard(session_id)
            if not self.user_sessions[user_id]:
                del self.user_sessions[user_id]
        
        logger.info(f"User {user_id} disconnected from haggle session {session_id}")
    
    async def broadcast_to_session(self, session_id: str, message: dict, exclude_websocket: WebSocket = None):
        """Broadcast a message to all connections in a haggle session."""
        if session_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[session_id]:
                if connection != exclude_websocket:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        logger.error(f"Error sending message: {e}")
                        disconnected.append(connection)
            
            # Clean up disconnected sockets
            for conn in disconnected:
                self.active_connections[session_id].discard(conn)
    
    async def send_personal_message(self, websocket: WebSocket, message: dict):
        """Send a message to a specific connection."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")


# Global connection manager
haggle_manager = HaggleConnectionManager()


@router.post("/start", response_model=HaggleSessionResponse)
async def start_haggle_endpoint(
    body: StartHaggleRequest,
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    session = await start_haggle(db, current_user.id, body)
    return HaggleSessionResponse.model_validate(session)


@router.post("/{session_id}/offer", response_model=HaggleSessionResponse)
async def send_offer_endpoint(
    session_id: UUID,
    body: HaggleOfferRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await send_offer(
        db, session_id, current_user.id, current_user.active_role, body
    )
    return HaggleSessionResponse.model_validate(session)


@router.post("/{session_id}/accept", response_model=HaggleSessionResponse)
async def accept_haggle_endpoint(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await accept_haggle(db, session_id, current_user.id)
    return HaggleSessionResponse.model_validate(session)


@router.post("/{session_id}/reject", response_model=HaggleSessionResponse)
async def reject_haggle_endpoint(
    session_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    session = await reject_haggle(db, session_id, current_user.id)
    return HaggleSessionResponse.model_validate(session)


@router.get("/my", response_model=HaggleListResponse)
async def get_my_haggles_endpoint(
    current_user: User = Depends(require_customer),
    db: AsyncSession = Depends(get_db),
):
    sessions, total = await get_customer_haggles(db, current_user.id)
    return HaggleListResponse(
        items=[HaggleSessionResponse.model_validate(s) for s in sessions],
        total=total,
    )


@router.get("/shop/{shop_id}", response_model=HaggleListResponse)
async def get_shop_haggles_endpoint(
    shop_id: UUID,
    current_user: User = Depends(require_business),
    db: AsyncSession = Depends(get_db),
):
    sessions, total = await get_shop_haggles(db, shop_id, current_user.id)
    return HaggleListResponse(
        items=[HaggleSessionResponse.model_validate(s) for s in sessions],
        total=total,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET ENDPOINT FOR REAL-TIME HAGGLE CHAT
# ═══════════════════════════════════════════════════════════════════════════════

@router.websocket("/ws/{session_id}")
async def haggle_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time haggle communication.
    
    Connect with: ws://host/api/v1/haggle/ws/{session_id}?token=JWT_TOKEN
    
    Message Types (client -> server):
    - {"type": "offer", "amount": 450, "message": "My final offer"}
    - {"type": "accept"}
    - {"type": "reject"}
    - {"type": "typing"}
    - {"type": "message", "text": "Can you do better?"}
    
    Message Types (server -> client):
    - {"type": "offer", "from": "customer|shop", "amount": 450, "message": "..."}
    - {"type": "accepted", "final_price": 450}
    - {"type": "rejected"}
    - {"type": "typing", "from": "customer|shop"}
    - {"type": "message", "from": "customer|shop", "text": "..."}
    - {"type": "error", "message": "..."}
    """
    user_id = None
    
    try:
        # Verify token
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if not user_id:
                await websocket.close(code=4001, reason="Invalid token")
                return
        except Exception as e:
            logger.error(f"Token verification failed: {e}")
            await websocket.close(code=4001, reason="Invalid token")
            return
        
        # Connect to session
        await haggle_manager.connect(websocket, session_id, user_id)
        
        # Get user role for this session
        async with get_async_session() as db:
            from app.haggle.models import HaggleSession
            result = await db.execute(
                select(HaggleSession).where(HaggleSession.id == UUID(session_id))
            )
            haggle_session = result.scalar_one_or_none()
            
            if not haggle_session:
                await websocket.send_json({"type": "error", "message": "Session not found"})
                await websocket.close(code=4004, reason="Session not found")
                return
            
            # Determine role
            if str(haggle_session.customer_id) == user_id:
                role = "customer"
            else:
                role = "shop"
        
        # Send session state
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "role": role,
            "status": haggle_session.status,
        })
        
        # Listen for messages
        while True:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "offer":
                    # Process offer
                    amount = data.get("amount")
                    message = data.get("message", "")
                    
                    if amount is None:
                        await websocket.send_json({"type": "error", "message": "Amount is required"})
                        continue
                    
                    # Update session in database
                    async with get_async_session() as db:
                        from app.haggle.models import HaggleSession, HaggleMessage
                        result = await db.execute(
                            select(HaggleSession).where(HaggleSession.id == UUID(session_id))
                        )
                        session = result.scalar_one_or_none()
                        
                        if session and session.status == "active":
                            db.add(
                                HaggleMessage(
                                    session_id=session.id,
                                    sender_role=role,
                                    offer_amount=Decimal(str(amount)),
                                    message=message,
                                )
                            )
                            await db.commit()
                    
                    # Broadcast offer to session
                    await haggle_manager.broadcast_to_session(session_id, {
                        "type": "offer",
                        "from": role,
                        "amount": amount,
                        "message": message,
                    })
                
                elif msg_type == "accept":
                    # Accept current offer
                    async with get_async_session() as db:
                        from app.haggle.models import HaggleSession, HaggleMessage
                        result = await db.execute(
                            select(HaggleSession).where(HaggleSession.id == UUID(session_id))
                        )
                        session = result.scalar_one_or_none()
                        
                        if session and session.status == "active":
                            final_offer_result = await db.execute(
                                select(HaggleMessage.offer_amount)
                                .where(
                                    HaggleMessage.session_id == session.id,
                                    HaggleMessage.offer_amount.is_not(None),
                                )
                                .order_by(HaggleMessage.created_at.desc())
                                .limit(1)
                            )
                            final_price = final_offer_result.scalar_one_or_none()
                            if final_price is None:
                                await websocket.send_json({"type": "error", "message": "No offer available to accept"})
                                continue

                            session.status = "accepted"
                            session.final_price = final_price
                            await db.commit()
                            
                            # Broadcast acceptance
                            await haggle_manager.broadcast_to_session(session_id, {
                                "type": "accepted",
                                "final_price": float(final_price) if final_price else None,
                            })
                
                elif msg_type == "reject":
                    # Reject haggle
                    async with get_async_session() as db:
                        from app.haggle.models import HaggleSession
                        result = await db.execute(
                            select(HaggleSession).where(HaggleSession.id == UUID(session_id))
                        )
                        session = result.scalar_one_or_none()
                        
                        if session and session.status == "active":
                            session.status = "rejected"
                            await db.commit()
                            
                            # Broadcast rejection
                            await haggle_manager.broadcast_to_session(session_id, {
                                "type": "rejected",
                                "from": role,
                            })
                
                elif msg_type == "typing":
                    # Broadcast typing indicator
                    await haggle_manager.broadcast_to_session(
                        session_id,
                        {"type": "typing", "from": role},
                        exclude_websocket=websocket
                    )
                
                elif msg_type == "message":
                    # Chat message
                    text = data.get("text", "")
                    if text:
                        async with get_async_session() as db:
                            from app.haggle.models import HaggleSession, HaggleMessage
                            result = await db.execute(
                                select(HaggleSession).where(HaggleSession.id == UUID(session_id))
                            )
                            session = result.scalar_one_or_none()
                            if session and session.status == "active":
                                db.add(
                                    HaggleMessage(
                                        session_id=session.id,
                                        sender_role=role,
                                        message=text,
                                    )
                                )
                                await db.commit()
                        await haggle_manager.broadcast_to_session(session_id, {
                            "type": "message",
                            "from": role,
                            "text": text,
                        })
                
                else:
                    await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})
            
            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                await websocket.send_json({"type": "error", "message": str(e)})
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if user_id:
            haggle_manager.disconnect(websocket, session_id, user_id)
