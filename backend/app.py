from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import requests
from groq import Groq
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)

load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
HUGGINGFACE_API_KEY = os.environ.get("HUGGINGFACE_API_KEY", "")

# Initialize Groq client if key exists
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

@app.route('/api/chat', methods=['POST'])
def chat():
    if not groq_client:
        return jsonify({"error": "Groq API Key is not set in backend. Please set GROQ_API_KEY environment variable."}), 500
        
    data = request.json
    messages = data.get("messages", [])
    
    # We use llama-3.3-70b-versatile as requested
    try:
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "generate_image",
                    "description": "Use this tool to generate an image when the user asks for one. Provide a detailed image generation prompt.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "prompt": {
                                "type": "string",
                                "description": "The detailed description of the image to generate.",
                            }
                        },
                        "required": ["prompt"],
                    },
                },
            }
        ]
        
        # inject a system prompt if not present
        sys_msg_exists = any(m.get("role") == "system" for m in messages)
        if not sys_msg_exists:
            messages.insert(0, {
                "role": "system", 
                "content": "You are a helpful AI assistant. If the user asks you to generate or create an image, picture, or drawing, you MUST use the `generate_image` tool. Do NOT output raw <function> XML tags. Only use the standard JSON tool calling format. If the user just wants to chat, reply normally."
            })

        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=tools,
            temperature=0.7,
            max_tokens=1024,
            top_p=1,
            stream=False,
            stop=None,
        )
        
        message = completion.choices[0].message
        
        if message.tool_calls:
            tool_call = message.tool_calls[0]
            if tool_call.function.name == "generate_image":
                import json
                args = json.loads(tool_call.function.arguments)
                prompt = args.get("prompt", "")
                return jsonify({"action": "generate_image", "prompt": prompt})

        response_text = message.content or ""
        return jsonify({"response": response_text})
    except Exception as e:
        error_str = str(e)
        if "tool_use_failed" in error_str and "<function=generate_image" in error_str:
            import re, json
            match = re.search(r'<function=generate_image (\{.*?\}) </function>', error_str)
            if match:
                try:
                    args = json.loads(match.group(1))
                    prompt = args.get("prompt", "")
                    return jsonify({"action": "generate_image", "prompt": prompt})
                except:
                    pass
        return jsonify({"error": error_str}), 500

@app.route('/api/generate-image', methods=['POST'])
def generate_image():
    if not HUGGINGFACE_API_KEY:
        return jsonify({"error": "Hugging Face API Key is not set in backend. Please set HUGGINGFACE_API_KEY environment variable."}), 500
        
    data = request.json
    prompt = data.get("prompt", "")
    
    # Hugging Face Inference API for Flux
    API_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell"
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
    
    try:
        response = requests.post(API_URL, headers=headers, json={"inputs": prompt})
        if response.status_code == 200:
            import base64
            encoded_string = base64.b64encode(response.content).decode("utf-8")
            image_url = f"data:image/jpeg;base64,{encoded_string}"
            return jsonify({"image_url": image_url})
        else:
            return jsonify({"error": f"Failed to generate image: {response.text}"}), response.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
