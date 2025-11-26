#!/usr/bin/env python3
"""
Test geocoding for Mangalore zip code 581325
"""
import requests

# Test geocoding
zip_code = "581325"
url = f"https://nominatim.openstreetmap.org/search?q={zip_code}&format=json&limit=1"

headers = {
    'User-Agent': 'StressMonitorApp/1.0 (contact@example.com)'
}

print(f"Testing geocoding for zip code: {zip_code}")
print(f"URL: {url}\n")

response = requests.get(url, headers=headers, timeout=5)
results = response.json()

if results:
    print("Geocoding Result:")
    print(f"  Display Name: {results[0].get('display_name')}")
    print(f"  Latitude: {results[0].get('lat')}")
    print(f"  Longitude: {results[0].get('lon')}")
    print(f"  Type: {results[0].get('type')}")
    
    # Now search for hospitals near this location
    lat = float(results[0]['lat'])
    lon = float(results[0]['lon'])
    
    print(f"\nSearching for hospitals near {lat}, {lon}...")
    
    delta = 0.1
    viewbox = f"{lon-delta},{lat+delta},{lon+delta},{lat-delta}"
    
    hospital_url = "https://nominatim.openstreetmap.org/search"
    params = {
        'q': 'hospital',
        'format': 'json',
        'limit': 10,
        'viewbox': viewbox,
        'bounded': 1,
        'addressdetails': 1
    }
    
    hosp_response = requests.get(hospital_url, params=params, headers=headers, timeout=5)
    hospitals = hosp_response.json()
    
    print(f"Found {len(hospitals)} hospitals:")
    for i, h in enumerate(hospitals[:5], 1):
        print(f"\n{i}. {h.get('name', 'Unknown')}")
        print(f"   Type: {h.get('type')}")
        print(f"   Location: {h.get('lat')}, {h.get('lon')}")
        if 'address' in h:
            addr = h['address']
            print(f"   Address: {addr.get('road', '')}, {addr.get('city', '')}")
else:
    print("No results found for this zip code!")
    print("\nTrying with 'Mangalore' instead...")
    
    url2 = "https://nominatim.openstreetmap.org/search?q=Mangalore&format=json&limit=1"
    response2 = requests.get(url2, headers=headers, timeout=5)
    results2 = response2.json()
    
    if results2:
        print(f"Mangalore coordinates: {results2[0]['lat']}, {results2[0]['lon']}")
