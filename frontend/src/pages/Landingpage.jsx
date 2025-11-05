// frontend/src/pages/Landingpage.jsx
import React from 'react'
import { Link } from 'react-router-dom'

const Landingpage = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="max-w-4xl mx-auto px-6 py-12 text-center">
                <h1 className="text-5xl font-bold text-gray-900 mb-6">
                    Stress Detection System
                </h1>
                <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                    Monitor and analyze your stress levels with our advanced detection technology.
                    Get insights into your well-being and take control of your mental health.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                    <Link
                        to="/session"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition duration-300 transform hover:scale-105"
                    >
                        Start New Session
                    </Link>
                    <Link
                        to="/summary"
                        className="bg-white hover:bg-gray-50 text-indigo-600 font-semibold py-3 px-8 rounded-lg border-2 border-indigo-600 transition duration-300 transform hover:scale-105"
                    >
                        View Summary
                    </Link>
                </div>

                <div className="grid md:grid-cols-3 gap-8 mt-16">
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Monitoring</h3>
                        <p className="text-gray-600">Track your stress levels in real-time with advanced sensors and algorithms.</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Accurate Analysis</h3>
                        <p className="text-gray-600">Get precise insights into your stress patterns and triggers.</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Results</h3>
                        <p className="text-gray-600">Receive instant feedback and recommendations for stress management.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Landingpage
