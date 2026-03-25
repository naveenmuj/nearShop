#!/bin/bash
# NearShop - Start All Services (Backend, Web, Mobile)
# Usage: ./start-all.sh

set -e

echo "🚀 NearShop - Starting All Services"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}⚠️  tmux not found. Please install tmux for this script to work.${NC}"
    echo "On macOS: brew install tmux"
    echo "On Ubuntu: sudo apt-get install tmux"
    exit 1
fi

# Kill any existing sessions
tmux kill-session -t nearshop 2>/dev/null || true
sleep 1

# Create new session
tmux new-session -d -s nearshop -x 200 -y 50

# Window 1: Backend API
echo -e "${BLUE}📦 Starting Backend API...${NC}"
tmux new-window -t nearshop -n backend -c "$(pwd)/nearshop-api"
tmux send-keys -t nearshop:backend "echo '🔧 Backend API Starting...' && python -m uvicorn app.main:app --reload --port 8000" Enter

sleep 3

# Window 2: Web App
echo -e "${BLUE}🌐 Starting Web App...${NC}"
tmux new-window -t nearshop -n web -c "$(pwd)/nearshop-web"
tmux send-keys -t nearshop:web "echo '🌐 Web App Starting...' && npm run dev" Enter

sleep 3

# Window 3: Mobile App
echo -e "${BLUE}📱 Starting Mobile App...${NC}"
tmux new-window -t nearshop -n mobile -c "$(pwd)/nearshop-mobile"
tmux send-keys -t nearshop:mobile "echo '📱 Mobile App Starting...' && npm start" Enter

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "📡 Service URLs:"
echo "   Backend API:    http://localhost:8000"
echo "   API Docs:       http://localhost:8000/docs"
echo "   Web App:        http://localhost:5173"
echo "   Mobile:         Expo Go (scan QR code)"
echo ""
echo "🔍 View logs:"
echo "   Backend:  tmux send-keys -t nearshop:backend -X capture-pane -p"
echo "   Web:      tmux send-keys -t nearshop:web -X capture-pane -p"
echo "   Mobile:   tmux send-keys -t nearshop:mobile -X capture-pane -p"
echo ""
echo "🛑 Stop all services:"
echo "   tmux kill-session -t nearshop"
echo ""
echo "Attaching to tmux session..."
tmux attach-session -t nearshop
