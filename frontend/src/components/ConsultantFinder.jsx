// frontend/src/components/ConsultantFinder.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, Phone, Star, Navigation, Loader, AlertCircle } from "lucide-react";
import { getCurrentLocation, fetchNearbyConsultants, geocodeAddress } from "./recommendationService";

export default function ConsultantFinder() {
    const [consultants, setConsultants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [manualAddress, setManualAddress] = useState("");
    const [showManualInput, setShowManualInput] = useState(false);

    const handleFindNearby = async () => {
        setLoading(true);
        setError(null);
        // Clear previous results to ensure fresh search
        setConsultants([]);
        setUserLocation(null);

        try {
            // Get user's current location (FRESH - no cache)
            const location = await getCurrentLocation();
            setUserLocation(location);

            // Fetch nearby consultants
            const results = await fetchNearbyConsultants(location.lat, location.lon, 5);
            setConsultants(results);

            if (results.length === 0) {
                setError("No consultants found nearby. Showing virtual options.");
            }
        } catch (err) {
            console.error("Error finding nearby consultants:", err);
            setError(err.message);
            setShowManualInput(true);
        } finally {
            setLoading(false);
        }
    };

    const handleManualSearch = async (e) => {
        e.preventDefault();

        if (!manualAddress.trim()) {
            setError("Please enter a location");
            return;
        }

        setLoading(true);
        setError(null);
        // Clear previous results
        setConsultants([]);
        setUserLocation(null);

        try {
            // Geocode the address
            const location = await geocodeAddress(manualAddress);
            setUserLocation(location);

            // Fetch nearby consultants
            const results = await fetchNearbyConsultants(location.lat, location.lon, 5);
            setConsultants(results);

            if (results.length === 0) {
                setError("No consultants found near this location. Showing virtual options.");
            }
        } catch (err) {
            console.error("Error with manual search:", err);
            setError(err.message || "Could not find location. Please try a different address.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center">
                    <MapPin className="w-6 h-6 mr-2 text-indigo-600" />
                    Find Nearby Wellness Professionals
                </h3>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                    onClick={handleFindNearby}
                    disabled={loading}
                    className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {loading ? (
                        <>
                            <Loader className="w-5 h-5 mr-2 animate-spin" />
                            Searching...
                        </>
                    ) : (
                        <>
                            <Navigation className="w-5 h-5 mr-2" />
                            Use My Location
                        </>
                    )}
                </button>

                <button
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                >
                    <Search className="w-5 h-5 mr-2" />
                    Enter Location Manually
                </button>
            </div>

            {/* Manual Input Form */}
            <AnimatePresence>
                {showManualInput && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleManualSearch}
                        className="mb-6"
                    >
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualAddress}
                                onChange={(e) => setManualAddress(e.target.value)}
                                placeholder="Enter city, zip code, or address..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all"
                            >
                                Search
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Error Message */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start"
                >
                    <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                </motion.div>
            )}

            {/* User Location Info */}
            {userLocation && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-4 p-3 bg-indigo-50 rounded-lg"
                >
                    <p className="text-sm text-indigo-700">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Searching near: {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
                    </p>
                </motion.div>
            )}

            {/* Consultants List */}
            <AnimatePresence mode="wait">
                {consultants.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        {consultants.map((consultant, index) => (
                            <ConsultantCard key={consultant.id || index} consultant={consultant} index={index} />
                        ))}
                    </motion.div>
                ) : (
                    !loading && !error && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12 text-gray-500"
                        >
                            <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-lg">Click "Use My Location" to find nearby wellness professionals</p>
                            <p className="text-sm mt-2">Or enter your location manually</p>
                        </motion.div>
                    )
                )}
            </AnimatePresence>
        </div>
    );
}

// Consultant Card Component - Now Clickable!
function ConsultantCard({ consultant, index }) {
    const handleContactClick = () => {
        const contact = consultant.contact;

        if (!contact || contact === "Contact via Website") {
            // Try to open Google Maps search for the consultant
            if (consultant.lat && consultant.lon) {
                window.open(
                    `https://www.google.com/maps/search/?api=1&query=${consultant.lat},${consultant.lon}`,
                    '_blank'
                );
            }
            return;
        }

        // Check if contact is a URL
        if (contact.startsWith('http') || contact.startsWith('www')) {
            const url = contact.startsWith('http') ? contact : `https://${contact}`;
            window.open(url, '_blank');
        }
        // Check if contact is an email
        else if (contact.includes('@')) {
            window.location.href = `mailto:${contact}`;
        }
        // Check if contact is a phone number
        else if (contact.match(/[\d\-\+\(\)]/)) {
            window.location.href = `tel:${contact.replace(/[^\d\+]/g, '')}`;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={handleContactClick}
            className="p-5 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer group"
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                            {consultant.name}
                        </h4>
                        {consultant.is_virtual && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                                Virtual
                            </span>
                        )}
                    </div>

                    <p className="text-sm text-gray-600 mb-2">{consultant.specialty}</p>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        {consultant.distance_km !== undefined && (
                            <span className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1 text-indigo-500" />
                                {consultant.distance_km} km away
                            </span>
                        )}

                        {consultant.rating && (
                            <span className="flex items-center">
                                <Star className="w-4 h-4 mr-1 text-yellow-500 fill-yellow-500" />
                                {consultant.rating}
                            </span>
                        )}
                    </div>

                    {consultant.contact && (
                        <div className="mt-3 flex items-center text-sm">
                            <Phone className="w-4 h-4 mr-2 text-indigo-600" />
                            <span className="text-indigo-600 font-medium group-hover:underline">
                                {consultant.contact === "Contact via Website" ? "View on Map" : consultant.contact}
                            </span>
                        </div>
                    )}

                    <p className="mt-2 text-xs text-gray-400 italic">
                        Click to {consultant.contact === "Contact via Website" ? "view location" : "contact"}
                    </p>
                </div>

                {consultant.available && (
                    <div className="ml-4">
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                            Available
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
