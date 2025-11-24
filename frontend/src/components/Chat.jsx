import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/authContext/AuthContext';
import { Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// --- Shortening Function (NEW) ---
const shorten = (text, max = 280) => {
  if (!text) return "";
  return text.length > max ? text.substring(0, max) + "..." : text;
};

// --- Helper component for the chat bubbles ---
const ChatBubble = ({ message }) => {
  const isUser = message.sender === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`rounded-lg px-4 py-3 max-w-xs text-sm prose ${
          isUser
            ? 'bg-indigo-600 text-white prose-invert'
            : 'bg-gray-200 text-gray-900'
        }`}
      >
        <ReactMarkdown>{message.text}</ReactMarkdown>
      </div>
    </div>
  );
};

const suggestions = [
  "I feel stressed right now.",
  "Give me a relaxation tip.",
  "I'm not feeling productive."
];

const Chat = ({ sessionId }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Hello! You can ask me for hints or just tell me how you're feeling.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (prompt) => {
    if (isLoading) return;

    const userId = currentUser ? currentUser.uid : 'anonymous';
    const userMessage = { sender: 'user', text: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const chatPromise = axios.post('http://localhost:5000/api/chat', {
        prompt: prompt,
        userId: userId,
      });

      const stressPromise = axios.post('http://localhost:5000/api/process_text', {
        text: prompt,
        userId: userId,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
      });

      const [chatResponse, stressResponse] = await Promise.all([
        chatPromise,
        stressPromise,
      ]);

      // ✨ APPLY SHORTENING HERE
      const aiMessage = {
        sender: 'ai',
        text: shorten(chatResponse.data.response),
      };

      setMessages((prev) => [...prev, aiMessage]);

      console.log(
        'Textual Stress Score Logged:',
        stressResponse.data.stress_score
      );

    } catch (error) {
      console.error('Error processing chat:', error);
      const errorMessage = {
        sender: 'ai',
        text: 'Sorry, I ran into an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const prompt = input.trim();
    if (prompt) {
      sendMessage(prompt);
      setInput('');
    }
  };

  const handleSuggestionClick = (prompt) => {
    sendMessage(prompt);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col h-[600px]">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
        AI Wellness Assistant
      </h3>

      <div className="flex-1 overflow-y-auto pr-2">
        {messages.map((msg, index) => (
          <ChatBubble key={index} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="rounded-lg px-4 py-3 max-w-xs bg-gray-200 text-gray-900">
              <p className="text-sm italic">typing...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex flex-wrap gap-2 my-3">
        {suggestions.map((text) => (
          <button
            key={text}
            onClick={() => handleSuggestionClick(text)}
            disabled={isLoading || !currentUser}
            className="text-xs text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-full px-3 py-1 transition disabled:opacity-50"
          >
            {text}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex">
        <input
          type="text"
          className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
          placeholder="Ask for a hint or vent here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!currentUser || isLoading}
        />
        <button
          type="submit"
          className="bg-indigo-600 text-white px-5 py-3 rounded-r-lg hover:bg-indigo-700 disabled:opacity-50"
          disabled={!currentUser || isLoading || !input.trim()}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default Chat;
