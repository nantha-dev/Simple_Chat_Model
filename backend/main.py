import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from pymongo import MongoClient
from datetime import datetime


GROQ_API_KEY = "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"   # Move to env var!
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "chat_app"
COLLECTION_NAME = "messages"

client_groq = Groq(api_key=GROQ_API_KEY)
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[DB_NAME]
collection = db[COLLECTION_NAME]


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"

class ChatResponse(BaseModel):
    reply: str

SYSTEM_PROMPT = """
You are an advanced AI assistant.

Guidelines:
- Be helpful, honest, and accurate.
- Give direct answers first.
- Use clear structure and bullet points.
- Explain reasoning step by step when needed.
- Ask clarifying questions if information is missing.
- Never invent facts.
- For programming tasks, write clean and scalable code.
- For complex problems, break them into smaller steps.
- Keep responses concise unless detailed explanations are requested.

"""

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        
        response = client_groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": req.message}
            ]
        )
        reply = response.choices[0].message.content

        # Store message & reply in MongoDB
        collection.insert_one({
            "session_id": req.session_id,
            "user_message": req.message,
            "assistant_reply": reply,
            "timestamp": datetime.utcnow()
        })

        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{session_id}")
async def get_history(session_id: str):
    docs = collection.find({"session_id": session_id}).sort("timestamp", 1)
    return [
        {"user": doc["user_message"], "assistant": doc["assistant_reply"]}
        for doc in docs
    ]