#!/usr/bin/env python3
"""
Test script to verify consultant search for Mangalore area
"""
import sys
sys.path.insert(0, '.')

from consultant_service_v2 import consultant_service

# Mangalore coordinates (approximate city center)
MANGALORE_LAT = 12.9141
MANGALORE_LON = 74.8560

print("=" * 60)
print("Testing Consultant Search for Mangalore")
print("=" * 60)
print(f"\nSearching near: {MANGALORE_LAT}, {MANGALORE_LON}")
print("(Mangalore city center)\n")

# Search for consultants
results = consultant_service.find_nearby(MANGALORE_LAT, MANGALORE_LON, limit=10)

print(f"Found {len(results)} results:\n")

for i, consultant in enumerate(results, 1):
    print(f"{i}. {consultant['name']}")
    print(f"   Specialty: {consultant['specialty']}")
    print(f"   Distance: {consultant['distance_km']} km")
    print(f"   Virtual: {consultant.get('is_virtual', False)}")
    if 'lat' in consultant and 'lon' in consultant:
        print(f"   Location: {consultant['lat']}, {consultant['lon']}")
    print()

print("=" * 60)
print("Note: These are REAL locations from OpenStreetMap")
print("Results will vary based on exact GPS coordinates")
print("=" * 60)
