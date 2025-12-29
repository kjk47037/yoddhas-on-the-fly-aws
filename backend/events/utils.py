import requests
from datetime import datetime, timedelta
from django.utils import timezone

# Example function to fetch global holidays using Calendarific API
def fetch_global_holidays():
    holidays = []
    url = 'https://calendarific.com/api/v2/holidays'
    current_year = datetime.now().year
    params = {
        'api_key': 'rh43rV6WUyrGvOpLND4Xgqw60fHtBh4B',
        'country': 'IN',  # India
        'year': str(current_year)  # Use current year
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()

        # Get current date for filtering upcoming holidays
        now = timezone.now()
        thirty_days_from_now = now + timedelta(days=30)

        for holiday in data['response']['holidays']:
            # Parse the holiday date - handle both date-only and datetime formats
            date_str = holiday['date']['iso']
            if 'T' in date_str:
                # If it includes time, parse it and convert to date only
                holiday_date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
            else:
                # If it's date only
                holiday_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # Convert to datetime and make timezone aware
            holiday_datetime = datetime.combine(holiday_date, datetime.min.time())
            holiday_datetime = timezone.make_aware(holiday_datetime)
            
            # Only include upcoming holidays within next 30 days
            if now <= holiday_datetime <= thirty_days_from_now:
                holidays.append({
                    "title": holiday['name'],
                    "description": holiday['description'],
                    "location": "India",
                    "event_type": "Holiday",
                    "date": holiday_datetime,
                    "trending_score": 85  # Example score for holidays
                })
    except Exception as e:
        print(f"Error fetching holidays: {e}")

    return holidays

# Example function to fetch location-specific events (weather changes, local festivals)
def fetch_location_events(location):
    # Example using OpenWeatherMap for significant weather changes
    weather_events = []
    weather_api_key = '6b734670c9afdd12cfce70f6f48d6a08'
    weather_url = f'http://api.openweathermap.org/data/2.5/weather?q={location}&appid={weather_api_key}'
    
    try:
        weather_response = requests.get(weather_url)
        weather_data = weather_response.json()

        if weather_data['weather'][0]['main'] == 'Rain':
            weather_events.append({
                "title": "Heavy Rain Alert",
                "description": f"Heavy rain expected in {location}",
                "location": location,
                "event_type": "Weather Change",
                "date": timezone.now() + timedelta(hours=1),  # Weather event happening soon
                "trending_score": 90
            })
    except Exception as e:
        print(f"Error fetching weather events: {e}")

    # Example for local events like festivals using Eventbrite API (optional)
    # You can fetch events based on the location using the Eventbrite API.

    return weather_events

# Fetch trending events (global and location-specific events)
def fetch_trending_events():
    events = []

    # Global Events: Holidays and Festivals (Example using Calendarific API)
    holidays = fetch_global_holidays()  # Fetch upcoming holidays only
    events.extend(holidays)

    # Location-Specific Events (Example using OpenWeatherMap API)
    location_events = fetch_location_events("India")  # Fetch weather changes, local festivals
    events.extend(location_events)

    return events
