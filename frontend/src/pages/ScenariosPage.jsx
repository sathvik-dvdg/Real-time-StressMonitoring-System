import React from 'react';
import { ShieldCheck, User, Briefcase } from 'lucide-react'; // npm install lucide-react

const ScenariosPage = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white shadow-lg rounded-lg mt-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Current Scenarios & Use Cases</h1>
      <p className="text-lg text-gray-700 leading-relaxed mb-8">
        This system is designed for any individual in a high-pressure digital environment. Our goal is to provide a non-invasive tool that works with a standard computer, making wellness monitoring accessible to everyone.
      </p>
      
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">For Students</h3>
            <p className="text-gray-700 mt-1">
              During long study sessions, exam preparation, or while working on difficult coding assignments. The system can help identify when cognitive load is turning into negative stress, prompting a user to take a break *before* they burn out.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">For Professionals</h3>
            <p className="text-gray-700 mt-1">
              In remote work environments, call centers, or during high-stakes project deadlines. The AI wellness assistant provides a safe outlet to vent frustration, while the system logs this data, helping users track their mental state over time.
            </p>
          </div>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">For Proactive Wellness</h3>
            <p className="text-gray-700 mt-1">
              The primary use case is prevention. By providing a real-time dashboard, users can see the correlation between their activities (e.g., a difficult task) and their stress levels, empowering them to manage their well-being.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenariosPage;