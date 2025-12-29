import tweepy
import pandas as pd
import json
import os
from datetime import datetime, timedelta
import time
import emoji
import re
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Twitter API credentials
API_KEY = os.getenv('API_KEY')
API_SECRET = os.getenv('API_SECRET')
ACCESS_TOKEN = os.getenv('ACCESS_TOKEN')
ACCESS_TOKEN_SECRET = os.getenv('ACCESS_TOKEN_SECRET')
BEARER_TOKEN = os.getenv('BEARER_TOKEN')

# Constants
SAVE_INTERVAL = 20  # Save after every 10 tweets
RATE_LIMIT_WAIT = 17 * 60  # 17 minutes wait for rate limit
MAX_RETRIES = 5

def setup_twitter_api():
    """Setup Twitter API with error handling for missing credentials"""
    try:
        # Create Tweepy v2 client with Bearer token
        client = tweepy.Client(
            bearer_token=BEARER_TOKEN,
            consumer_key=API_KEY, 
            consumer_secret=API_SECRET,
            access_token=ACCESS_TOKEN, 
            access_token_secret=ACCESS_TOKEN_SECRET,
            wait_on_rate_limit=True
        )
        
        logger.debug("Twitter API client created successfully")
        return client
        
    except Exception as e:
        logger.error(f"Error setting up Twitter API: {str(e)}")
        raise

def load_checkpoint(username):
    """Load the last saved checkpoint for a user"""
    checkpoint_file = f'backend/ml/training_data/checkpoint_{username}.json'
    if os.path.exists(checkpoint_file):
        with open(checkpoint_file, 'r') as f:
            return json.load(f)
    return None

def save_data_immediately(username, tweets_data, is_checkpoint=False):
    """Save data immediately after collection"""
    try:
        # Create directories if they don't exist
        os.makedirs('backend/ml/training_data', exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save as JSON
        if is_checkpoint:
            filename = f'backend/ml/training_data/checkpoint_{username}.json'
        else:
            filename = f'backend/ml/training_data/raw_tweets_{username}_{timestamp}.json'
            
        with open(filename, 'w') as f:
            json.dump(tweets_data, f, indent=2)
            
        logger.info(f"Saved {'checkpoint' if is_checkpoint else 'tweets'} to {filename}")
        
        # If not a checkpoint, also save as CSV
        if not is_checkpoint and tweets_data:
            df = pd.DataFrame(tweets_data)
            csv_filename = f'backend/ml/training_data/processed_features_{username}_{timestamp}.csv'
            
            feature_columns = [
                'content_length', 'hashtag_count', 'emoji_count', 'has_image',
                'post_time_hour', 'post_time_day', 'mentions_count', 'urls_count',
                'is_product_post', 'is_promotional', 'is_engagement_post', 'has_price',
                'favorite_count', 'retweet_count', 'reply_count', 'engagement_rate'
            ]
            
            # Ensure all feature columns exist
            for col in feature_columns:
                if col not in df.columns:
                    df[col] = 0
                    
            df[feature_columns].to_csv(csv_filename, index=False)
            logger.info(f"Saved features to {csv_filename}")
            
    except Exception as e:
        logger.error(f"Error saving data: {str(e)}")
        raise

def save_checkpoint(username, pagination_token, tweets_data):
    """Save current progress to a checkpoint file"""
    checkpoint = {
        'pagination_token': pagination_token,
        'tweets_data': tweets_data,
        'timestamp': datetime.now().isoformat()
    }
    
    save_data_immediately(username, checkpoint, is_checkpoint=True)
    logger.debug(f"Saved checkpoint with {len(tweets_data)} tweets")

def get_user_info(client, username):
    """Get user information using Twitter API v2"""
    try:
        # Look up user by username
        user = client.get_user(
            username=username,
            user_fields=['public_metrics']
        )
        
        if not user.data:
            raise Exception(f"User @{username} not found")
            
        logger.debug(f"Found user: {username} (ID: {user.data.id})")
        return user.data
        
    except Exception as e:
        logger.error(f"Error getting user info: {str(e)}")
        raise

def extract_features(tweet, user_followers_count):
    """Extract relevant features from a tweet"""
    try:
        # Get the text
        text = tweet.text if hasattr(tweet, 'text') else ''
        
        # Get entities safely
        entities = tweet.entities if hasattr(tweet, 'entities') else {}
        
        # Get hashtags
        hashtags = []
        if entities and 'hashtags' in entities:
            hashtags = entities['hashtags']
        
        # Get mentions
        mentions = []
        if entities and 'mentions' in entities:
            mentions = entities['mentions']
        
        # Get URLs
        urls = []
        if entities and 'urls' in entities:
            urls = entities['urls']
        
        # Check for media attachments
        has_image = False
        if hasattr(tweet, 'attachments') and tweet.attachments:
            has_image = 'media_keys' in tweet.attachments
        
        # Get created_at
        created_at = None
        if hasattr(tweet, 'created_at'):
            if isinstance(tweet.created_at, str):
                created_at = datetime.fromisoformat(tweet.created_at.replace('Z', '+00:00'))
            else:
                created_at = tweet.created_at
        
        # Basic text features
        features = {
            'content_length': len(text),
            'hashtag_count': len(hashtags),
            'emoji_count': len([c for c in text if c in emoji.EMOJI_DATA]),
            'has_image': 1 if has_image else 0,
            'post_time_hour': created_at.hour if created_at else 0,
            'post_time_day': created_at.weekday() if created_at else 0,
            'mentions_count': len(mentions),
            'urls_count': len(urls)
        }
        
        # Get metrics
        if hasattr(tweet, 'public_metrics'):
            metrics = tweet.public_metrics
            features.update({
                'favorite_count': metrics.get('like_count', 0),
                'retweet_count': metrics.get('retweet_count', 0),
                'reply_count': metrics.get('reply_count', 0),
                'engagement_rate': (metrics.get('like_count', 0) + metrics.get('retweet_count', 0)) / user_followers_count
                if user_followers_count > 0 else 0
            })
        else:
            features.update({
                'favorite_count': 0,
                'retweet_count': 0,
                'reply_count': 0,
                'engagement_rate': 0
            })
        
        # Content categories
        text_lower = text.lower()
        features.update({
            'is_product_post': 1 if any(word in text_lower for word in ['shop', 'store', 'buy', 'release', 'drop', 'available', 'merch', 'collection']) else 0,
            'is_promotional': 1 if any(word in text_lower for word in ['sale', 'discount', 'off', 'deal', 'limited', 'exclusive', 'special']) else 0,
            'is_engagement_post': 1 if any(word in text_lower for word in ['rt', 'follow', 'like', 'share', 'comment', 'tag', 'tell us']) else 0,
            'has_price': 1 if bool(re.search(r'\$\d+', text)) else 0
        })
        
        return features
        
    except Exception as e:
        logger.error(f"Error extracting features from tweet: {str(e)}")
        return None

def collect_training_data(username, num_tweets=1000):
    """Collect training data from a specific Twitter account"""
    try:
        # Setup Twitter API
        client = setup_twitter_api()
        
        # Get user info
        user = get_user_info(client, username)
        user_id = user.id
        followers_count = user.public_metrics['followers_count']
        
        logger.info(f"Collecting tweets for @{username} (Followers: {followers_count})")
        
        # Check for existing checkpoint
        checkpoint = load_checkpoint(username)
        if checkpoint:
            all_tweets = checkpoint['tweets_data']
            pagination_token = checkpoint['pagination_token']
            logger.info(f"Resuming from checkpoint with {len(all_tweets)} tweets")
        else:
            all_tweets = []
            pagination_token = None
        
        retries = 0
        while len(all_tweets) < num_tweets and retries < MAX_RETRIES:
            try:
                # Get user's tweets using v2 API
                tweets_response = client.get_users_tweets(
                    id=user_id,
                    max_results=20,  # Reduced batch size
                    pagination_token=pagination_token,
                    tweet_fields=['created_at', 'public_metrics', 'entities', 'attachments'],
                    expansions=['attachments.media_keys'],
                    media_fields=['url', 'preview_image_url']
                )
                
                if not tweets_response.data:
                    break
                
                # Process tweets
                new_tweets = 0
                for tweet in tweets_response.data:
                    features = extract_features(tweet, followers_count)
                    if features:
                        features['tweet_id'] = tweet.id
                        features['text'] = tweet.text
                        features['created_at'] = tweet.created_at.isoformat() if hasattr(tweet, 'created_at') else None
                        
                        all_tweets.append(features)
                        new_tweets += 1
                
                logger.info(f"Collected {new_tweets} new tweets (Total: {len(all_tweets)})")
                
                # Save data immediately after each batch
                save_data_immediately(username, all_tweets)
                
                # Check if we have more tweets to fetch
                if 'next_token' not in tweets_response.meta:
                    break
                    
                pagination_token = tweets_response.meta['next_token']
                save_checkpoint(username, pagination_token, all_tweets)
                
                # Reset retry counter on successful request
                retries = 0
                
                # Sleep between requests
                time.sleep(5)  # Increased delay between requests
                
            except tweepy.TweepyException as e:
                error_msg = str(e).lower()
                logger.error(f"Error collecting tweets: {error_msg}")
                
                if "rate limit" in error_msg:
                    # Save checkpoint before waiting
                    save_checkpoint(username, pagination_token, all_tweets)
                    
                    wait_time = RATE_LIMIT_WAIT
                    logger.warning(f"Rate limit exceeded. Waiting {wait_time/60} minutes...")
                    time.sleep(wait_time)
                    retries += 1
                else:
                    raise
        
        if not all_tweets:
            logger.warning(f"No tweets found for user {username}")
            return pd.DataFrame()
        
        # Final save
        save_data_immediately(username, all_tweets)
        
        # Clean up checkpoint after successful completion
        checkpoint_file = f'backend/ml/training_data/checkpoint_{username}.json'
        if os.path.exists(checkpoint_file):
            os.remove(checkpoint_file)
        
        logger.info(f"Successfully collected and processed {len(all_tweets)} tweets")
        return pd.DataFrame(all_tweets)
        
    except Exception as e:
        logger.error(f"Error in collect_training_data: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        # Collect data
        df = collect_training_data('gucci')
        print(f"Collected {len(df)} tweets for training")
        
        # Print some statistics
        if not df.empty:
            print("\nTraining Data Statistics:")
            print(f"Total Tweets: {len(df)}")
            print(f"Average Engagement Rate: {df['engagement_rate'].mean():.4f}")
            print(f"Product Posts: {df['is_product_post'].sum()}")
            print(f"Promotional Posts: {df['is_promotional'].sum()}")
            print(f"Posts with Images: {df['has_image'].sum()}")
            
    except Exception as e:
        print(f"Error collecting training data: {str(e)}") 