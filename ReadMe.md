
# Groq AI Chat (FastAPI + React + Vite + MongoDB)

Chat with Groq's Llama 3.3 via a web interface.  
Backend: Python (FastAPI) | Frontend: React (Vite) | DB: MongoDB

## Quick Start

### Backend
```bash
cd backend
pip install fastapi uvicorn groq pymongo python-dotenv
uvicorn main:app --reload --port 8000


### Frontend

bash
cd frontend
npm create vite@latest . -- --template react
npm install axios
npm run dev