from django.core.management.base import BaseCommand
from events.models import GlobalEvent
from events.utils import fetch_trending_events

class Command(BaseCommand):
    help = 'Fetch trending events from APIs and save to database'

    def handle(self, *args, **kwargs):
        # Fetch events from APIs
        events = fetch_trending_events()

        # Iterate through fetched events and save to the database
        for event in events:
            # Use get_or_create with date to avoid duplicates of same event on same date
            obj, created = GlobalEvent.objects.get_or_create(
                title=event['title'],
                date=event['date'],
                defaults={
                    'description': event['description'],
                    'location': event['location'],
                    'event_type': event.get('event_type', ''),
                    'trending_score': event['trending_score']
                }
            )
            
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Added new event: {event["title"]} on {event["date"]}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'Event already exists: {event["title"]} on {event["date"]}')
                )

        self.stdout.write(self.style.SUCCESS('Successfully processed events'))
