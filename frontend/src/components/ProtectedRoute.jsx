import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/authContext/AuthContext';
import AccessDeniedModal from './AccessDeniedModal';

const ProtectedRoute = ({ children }) => {
    const { userLoggedIn, loading } = useAuth();
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (!loading && !userLoggedIn) {
            setShowModal(true);
        }
    }, [loading, userLoggedIn]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!userLoggedIn) {
        return (
            <>
                <AccessDeniedModal
                    isOpen={showModal}
                    onClose={() => navigate('/')}
                />
                {/* Render a blurred placeholder background to avoid white screen */}
                <div className="min-h-screen bg-gray-100 blur-md pointer-events-none opacity-50" />
            </>
        );
    }

    return children;
};

export default ProtectedRoute;
