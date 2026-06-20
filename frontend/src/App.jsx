import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Mic, Send, Image as ImageIcon, Plus, User, Bot, Loader2 } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.error(event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const speakResponse = (text) => {
    if ('speechSynthesis' in window) {
      // Basic cleanup for speech
      const cleanText = text.replace(/[*_#]/g, '').slice(0, 250); 
      const utterance = new SpeechSynthesisUtterance(cleanText);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (input.toLowerCase().startsWith('/imagine ')) {
        const prompt = input.slice(9);
        const response = await axios.post('http://localhost:5000/api/generate-image', { prompt });
        const imageUrl = response.data.image_url;
        
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Here is the image you requested for: **${prompt}**`,
          image: imageUrl
        }]);
      } else {
        const contextMessages = messages
          .filter(m => !m.image && m.content) // Don't send image messages to LLaMA
          .map(m => ({ role: m.role, content: m.content }))
          .concat({ role: 'user', content: input });
        
        const response = await axios.post('http://localhost:5000/api/chat', { messages: contextMessages });
        
        if (response.data.action === 'generate_image') {
          const prompt = response.data.prompt;
          
          setMessages(prev => [...prev, { role: 'assistant', content: `Generating image for: **${prompt}**...` }]);
          
          try {
            const imgResponse = await axios.post('http://localhost:5000/api/generate-image', { prompt });
            const imageUrl = imgResponse.data.image_url;
            
            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                role: 'assistant',
                content: `Here is the image you requested for: **${prompt}**`,
                image: imageUrl
              };
              return newMessages;
            });
          } catch (err) {
            console.error(err);
            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                role: 'assistant',
                content: "Failed to generate image. Please check the backend console."
              };
              return newMessages;
            });
          }
        } else {
          const aiResponse = response.data.response;
          setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
          speakResponse(aiResponse);
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please ensure the backend is running and API keys are set in the .env file." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <button className="new-chat-btn" onClick={() => setMessages([])}>
          <Plus size={16} /> New Chat
        </button>
      </aside>

      <main className="main-chat">
        <div className="chat-history">
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '20vh' }}>
              <h2>How can I help you today?</h2>
              <p style={{ marginTop: '1rem' }}>Type /imagine or ask to generate an image.</p>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div key={index} className={`message-row ${msg.role === 'user' ? 'user' : 'ai'}`}>
              <div className="message-content">
                <div className={`avatar ${msg.role === 'user' ? 'user' : 'ai'}`}>
                  {msg.role === 'user' ? <User size={18} color="white" /> : <Bot size={18} color="white" />}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  {msg.image && (
                    <img src={msg.image} alt="Generated output" className="flux-image" />
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-row ai">
              <div className="message-content">
                <div className="avatar ai">
                  <Bot size={18} color="white" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={18} className="lucide-spin" color="var(--accent)" />
                  <span style={{ color: 'var(--text-secondary)' }}>Thinking...</span>
                  <style>{`
                    @keyframes spin {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                    .lucide-spin { animation: spin 1s linear infinite; }
                  `}</style>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-box">
            <button className="icon-btn" title="Type /imagine to generate an image">
              <ImageIcon size={20} />
            </button>
            <input 
              type="text" 
              placeholder="Message AI... or ask to generate an image"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className={`icon-btn ${isRecording ? 'recording' : ''}`} onClick={handleVoiceInput} title="Voice Input">
              <Mic size={20} />
            </button>
            <button className="icon-btn" onClick={handleSend} disabled={!input.trim()}>
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
