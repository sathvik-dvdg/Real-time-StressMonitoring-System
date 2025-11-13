import React from 'react';
import { Camera, Brain, MessageSquare, Database } from 'lucide-react';

const AboutPage = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white shadow-lg rounded-lg mt-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">About This Project (How It Works)</h1>
      <p className="text-lg text-gray-700 leading-relaxed mb-8">
        This project is a full-stack, multimodal AI system built with a React frontend and a Python (Flask) backend. It uses a "Backend for Frontend" (BFF) architecture, meaning our frontend only handles the UI, while the secure backend manages all ML models and database connections.
      </p>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Camera className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Real-time Facial Analysis</h3>
            <p className="text-gray-700 mt-1">
              The app streams your webcam at 1 FPS to our backend. A <strong>Random Forest</strong> model, trained on facial landmarks from <strong>MediaPipe</strong>, analyzes features like eye-blink rate and mouth shape to generate a 0-100 facial stress score.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Brain className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Real-time Textual Analysis</h3>
            <p className="text-gray-700 mt-1">
              When you chat with the AI, your text is sent to a pre-trained <strong>DistilRoBERTa</strong> model. This model classifies your text into 28 emotions. We use a custom heuristic to convert these emotions (e.g., "anger", "joy") into a 0-100 textual stress score.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">AI Wellness Assistant</h3>
            <p className="text-gray-700 mt-1">
              The chatbot is powered by the <strong>Google Gemini API</strong>. All prompts are prepended with a system instruction to keep replies short and conversational. This API runs in parallel with our stress model.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Database className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Secure Database</h3>
            <p className="text-gray-700 mt-1">
              All data is handled by our backend and saved securely in <strong>Firebase Firestore</strong>. The database is protected by security rules that ensure a user can only ever read or write their own data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;