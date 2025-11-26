import time
from typing import Any, Optional, Tuple

class TTLCache:
    """Simple Time-To-Live cache for consultant searches."""
    
    def __init__(self, ttl_seconds=1800):
        """
        Initialize TTL cache.
        
        Args:
            ttl_seconds: Time to live in seconds (default: 1800 = 30 minutes)
        """
        self.ttl_seconds = ttl_seconds
        self.cache = {}
    
    def _make_key(self, lat: float, lon: float, limit: int) -> str:
        """Create cache key from search parameters."""
        # Round to 2 decimal places to group nearby searches
        lat_rounded = round(lat, 2)
        lon_rounded = round(lon, 2)
        return f"{lat_rounded}:{lon_rounded}:{limit}"
    
    def get(self, lat: float, lon: float, limit: int) -> Optional[Any]:
        """
        Get cached results if available and not expired.
        
        Args:
            lat: Latitude
            lon: Longitude
            limit: Result limit
        
        Returns:
            Cached results or None if not found/expired
        """
        key = self._make_key(lat, lon, limit)
        
        if key in self.cache:
            cached_data, timestamp = self.cache[key]
            
            # Check if expired
            if time.time() - timestamp < self.ttl_seconds:
                return cached_data
            else:
                # Remove expired entry
                del self.cache[key]
        
        return None
    
    def set(self, lat: float, lon: float, limit: int, data: Any) -> None:
        """
        Store data in cache with current timestamp.
        
        Args:
            lat: Latitude
            lon: Longitude
            limit: Result limit
            data: Data to cache
        """
        key = self._make_key(lat, lon, limit)
        self.cache[key] = (data, time.time())
    
    def clear(self) -> None:
        """Clear all cached data."""
        self.cache.clear()
    
    def cleanup_expired(self) -> int:
        """
        Remove all expired entries from cache.
        
        Returns:
            Number of entries removed
        """
        current_time = time.time()
        expired_keys = [
            key for key, (_, timestamp) in self.cache.items()
            if current_time - timestamp >= self.ttl_seconds
        ]
        
        for key in expired_keys:
            del self.cache[key]
        
        return len(expired_keys)
