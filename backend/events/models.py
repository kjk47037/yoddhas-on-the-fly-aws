from django.db import models
from django.utils import timezone
from datetime import timedelta

class GlobalEvent(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(default="No description")
    location = models.CharField(max_length=255, default="Unknown")
    event_type = models.CharField(max_length=255, null=True, blank=True)
    date = models.DateTimeField()
    trending_score = models.FloatField()

    def __str__(self):
        return self.title

    def is_upcoming(self):
        """Check if the event is upcoming in the next 30 days"""
        return self.date >= timezone.now() and self.date <= timezone.now() + timedelta(days=30)

    def get_event_priority_score(self):
        """Return an adjusted score based on event type and proximity."""
        base_score = self.trending_score
        
        # Only consider upcoming events
        if not self.is_upcoming():
            return 0  # Past events get 0 priority
            
        # Calculate days until event
        days_until = (self.date - timezone.now()).days
        
        # Boost score based on proximity (closer events get higher scores)
        proximity_boost = max(0, 30 - days_until) * 2  # Up to 60 point boost for events today
        
        # Event type boost
        if self.event_type in ['Holiday', 'Weather']:
            base_score += 20  # Reduced from 50 to 20
            
        return base_score + proximity_boost
