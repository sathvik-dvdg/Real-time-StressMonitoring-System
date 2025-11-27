import math
import requests
import logging
from cache import TTLCache

logger = logging.getLogger(__name__)

class ConsultantService:
    def __init__(self):
        # Initialize TTL cache (30 minutes = 1800 seconds)
        self.cache = TTLCache(ttl_seconds=1800)

    def find_nearby(self, lat, lon, limit=5):
        """
        Finds nearby wellness professionals using OpenStreetMap (Nominatim) API.
        This ensures REAL, location-based data is returned.
        Results are cached for 30 minutes to reduce API calls.
        """
        if not lat or not lon:
            return self._get_virtual_options()
        
        # Check cache first
        cached_results = self.cache.get(lat, lon, limit)
        if cached_results is not None:
            logger.info(f"Returning cached results for lat={lat}, lon={lon}")
            return cached_results

        logger.info(f"🔍 Searching consultants for lat={lat}, lon={lon}")

        try:
            # Calculate a bounding box (~20km radius for better coverage)
            # 1 deg latitude ~= 111km
            delta = 0.18  # Increased from 0.1 to ~20km radius
            min_lat = float(lat) - delta
            max_lat = float(lat) + delta
            min_lon = float(lon) - delta
            max_lon = float(lon) + delta
            
            viewbox = f"{min_lon},{max_lat},{max_lon},{min_lat}"
            
            headers = {
                'User-Agent': 'StressMonitorApp/1.0 (contact@example.com)'
            }
            
            # Try multiple search terms for better results
            search_terms = ['hospital', 'clinic', 'doctor', 'health center']
            all_results = []
            
            for term in search_terms:
                url = "https://nominatim.openstreetmap.org/search"
                params = {
                    'q': term, 
                    'format': 'json',
                    'limit': limit * 2,  # Get more results to filter
                    'viewbox': viewbox,
                    'bounded': 1,
                    'addressdetails': 1
                }
                
                try:
                    response = requests.get(url, params=params, headers=headers, timeout=5)
                    response.raise_for_status()
                    results = response.json()
                    all_results.extend(results)
                    
                    # If we have enough results, stop searching
                    if len(all_results) >= limit:
                        break
                except Exception as e:
                    logger.warning(f"Search for '{term}' failed: {e}")
                    continue
            
            # Remove duplicates based on place_id
            seen_ids = set()
            unique_results = []
            for item in all_results:
                place_id = item.get('place_id')
                if place_id and place_id not in seen_ids:
                    seen_ids.add(place_id)
                    unique_results.append(item)
            
            consultants = []
            for i, item in enumerate(unique_results[:limit]):  # Limit to requested number
                # Calculate actual distance
                dist = self._haversine_distance(float(lat), float(lon), float(item['lat']), float(item['lon']))
                
                # Format as a "consultant"
                consultants.append({
                    "id": int(item.get('place_id', i)),
                    "name": item.get('name', 'Wellness Center'),
                    "specialty": item.get('type', 'General Health').capitalize(),
                    "lat": float(item['lat']),
                    "lon": float(item['lon']),
                    "contact": "Contact via Website", # OSM doesn't always have phone numbers
                    "available": True,
                    "rating": 4.5, # Placeholder rating as OSM doesn't have ratings
                    "distance_km": round(dist, 1),
                    "is_virtual": False
                })
                
            if not consultants:
                return self._get_virtual_options()
            
            # Cache the results before returning
            self.cache.set(lat, lon, limit, consultants)
            logger.info(f"Cached {len(consultants)} consultants for lat={lat}, lon={lon}")
                
            return consultants

        except Exception as e:
            logger.error(f"Error fetching real consultants: {e}")
            return self._get_virtual_options()

    def _get_virtual_options(self):
        """Returns verified virtual/online mental health resources."""
        return [
            {
                "id": 101,
                "name": "BetterHelp Global",
                "specialty": "Online Therapy",
                "contact": "www.betterhelp.com",
                "available": True,
                "rating": 4.8,
                "is_virtual": True
            },
            {
                "id": 102,
                "name": "Talkspace",
                "specialty": "Licensed Therapists",
                "contact": "www.talkspace.com",
                "available": True,
                "rating": 4.7,
                "is_virtual": True
            },
            {
                "id": 103,
                "name": "7 Cups",
                "specialty": "Free Emotional Support",
                "contact": "www.7cups.com",
                "available": True,
                "rating": 4.6,
                "is_virtual": True
            }
        ]

    def _haversine_distance(self, lat1, lon1, lat2, lon2):
        R = 6371  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2) * math.sin(dlat / 2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dlon / 2) * math.sin(dlon / 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

consultant_service = ConsultantService()
