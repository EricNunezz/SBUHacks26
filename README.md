# GitStation

Paste a GitHub repo link, get an AI-generated interactive architecture diagram.
This is a minimal skeleton: the layout and a backend health check work, nothing else yet.

```
frontend/   React + Vite + Tailwind v4 + React Flow (plain JavaScript)
backend/    FastAPI (Python)
```

## Setup

### Backend (Python 3.12)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in your keys
```

### Frontend (Node 20+)

```bash
cd frontend
npm install
```

## Run (two terminals)

```bash
# Terminal 1 - backend on http://localhost:8000
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 - frontend on http://localhost:5173
cd frontend
npm run dev
```

Open http://localhost:5173. The sidebar should say **Backend: connected**,
and the board shows two linked placeholder nodes.

## Where things live

- `backend/main.py` - FastAPI app, CORS, `GET /api/health`
- `frontend/src/App.jsx` - page layout and routes
- `frontend/src/components/Sidebar.jsx` - sidebar + backend status check
- `frontend/src/components/DiagramBoard.jsx` - React Flow board
