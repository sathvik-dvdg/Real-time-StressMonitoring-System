import React from 'react';

const ObjectivePage = () => {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white shadow-lg rounded-lg mt-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        Project Objective & Problem Statement
      </h1>
      
      <h2 className="text-2xl font-semibold text-indigo-600 my-4">Problem Statement</h2>
      <p className="text-lg text-gray-700 leading-relaxed">
        Existing non-invasive stress detection systems often fail to provide a robust, real-time assessment because they rely on a single data modality (e.g., facial cues <strong>or</strong> text analysis alone). This makes them vulnerable to errors; for example, a facial model may misinterpret a frown of concentration as stress.
      </p>
      
      <h2 className="text-2xl font-semibold text-indigo-600 my-4">Our Objective</h2>
      <p className="text-lg text-gray-700 leading-relaxed mb-4">
        This project addresses the need for an accessible, multimodal AI framework that <strong>fuses real-time data from two complementary channels</strong>: facial micro-expressions (physical arousal) and fine-grained textual emotion analysis (cognitive/affective state).
      </p>
      <p className="text-lg text-gray-700 leading-relaxed">
        The objective is to generate a synthesized, objective stress score, which is then logged to a secure database and visualized on a dashboard. This provides users with immediate, actionable feedback, enabling proactive intervention and the prevention of high-cognitive-load burnout in digital workspaces.
      </p>
    </div>
  );
};

export default ObjectivePage;