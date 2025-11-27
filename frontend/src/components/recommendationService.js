// frontend/src/components/recommendationService.js
// API service for fetching recommendations and nearby consultants

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Get user's current location using browser geolocation API
 * @returns {Promise<{lat: number, lon: number}>}
 */
export const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log("📍 Browser Geolocation:", position.coords.latitude, position.coords.longitude);
                resolve({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                });
            },
            (error) => {
                let errorMessage = 'Unable to retrieve your location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please enable location access.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out.';
                        break;
                    default:
                        errorMessage = 'An unknown error occurred.';
                }
                reject(new Error(errorMessage));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    });
};

/**
 * Fetch nearby wellness consultants based on location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} limit - Maximum number of results (default: 5)
 * @returns {Promise<Array>}
 */
export const fetchNearbyConsultants = async (lat, lon, limit = 5) => {
    try {
        const response = await fetch(`${API_BASE_URL}/consultants/nearby`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lat, lon, limit }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.error || 'Failed to fetch consultants');
        }

        return data.consultants || [];
    } catch (error) {
        console.error('Error fetching nearby consultants:', error);
        throw error;
    }
};

/**
 * Fetch AI-powered wellness recommendations
 * @param {number} stressScore - Current stress score (0-100)
 * @param {Object} emotionData - Detected emotions with percentages
 * @param {Object} sessionContext - Optional session context
 * @returns {Promise<Object>}
 */
export const fetchRecommendations = async (stressScore, emotionData = {}, sessionContext = null) => {
    try {
        const response = await fetch(`${API_BASE_URL}/recommendations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                stress_score: stressScore,
                emotion_data: emotionData,
                session_context: sessionContext,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.error || 'Failed to fetch recommendations');
        }

        return data.recommendations || {};
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        throw error;
    }
};

/**
 * Geocode an address/city to coordinates (using Nominatim)
 * Enhanced for Indian locations and zip codes
 * @param {string} address - Address, city name, or zip code
 * @returns {Promise<{lat: number, lon: number, name: string}>}
 */
export const geocodeAddress = async (address) => {
    try {
        // Special handling for known Karnataka pin codes
        // Each pin code maps to its ACTUAL location for accurate consultant search
        const karnatakaZipCodes = {
            // Mangalore area pin codes
            '575001': { lat: 12.9141, lon: 74.8560, name: 'Mangalore City' },
            '575002': { lat: 12.8698, lon: 74.8428, name: 'Mangalore' },
            '575003': { lat: 12.9167, lon: 74.8500, name: 'Mangalore' },
            '575004': { lat: 12.8667, lon: 74.8833, name: 'Mangalore' },
            '575005': { lat: 12.8500, lon: 74.8500, name: 'Mangalore' },
            '575006': { lat: 12.9000, lon: 74.9000, name: 'Mangalore' },
            '574142': { lat: 12.9141, lon: 74.8560, name: 'Mangalore/Bantwal' },

            // Dandeli area pin code
            '581325': { lat: 15.2667, lon: 74.6167, name: 'Dandeli' },
        };

        // Check if it's a known Karnataka pin code
        const trimmedAddress = address.trim();
        if (karnatakaZipCodes[trimmedAddress]) {
            console.log(`Using known coordinates for ${trimmedAddress}:`, karnatakaZipCodes[trimmedAddress]);
            return karnatakaZipCodes[trimmedAddress];
        }

        // For Indian zip codes, append "India" to improve geocoding
        let searchQuery = address;
        if (/^\d{6}$/.test(trimmedAddress)) {
            searchQuery = `${address}, India`;
        }

        // Try geocoding with Nominatim
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1&countrycodes=in`,
            {
                headers: {
                    'User-Agent': 'StressMonitorApp/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            // Fallback: if searching for a number (zip code) and not found, use Mangalore center
            if (/^\d{6}$/.test(trimmedAddress)) {
                console.warn(`Zip code ${trimmedAddress} not found, using Mangalore center`);
                return { lat: 12.9141, lon: 74.8560, name: 'Mangalore (default)' };
            }
            throw new Error(`Location "${address}" not found. Try entering a city name like "Mangalore" or "Bantwal"`);
        }

        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon),
            name: data[0].display_name
        };
    } catch (error) {
        console.error('Geocoding error:', error);
        throw new Error(error.message || 'Failed to find location. Please try a different address.');
    }
};
