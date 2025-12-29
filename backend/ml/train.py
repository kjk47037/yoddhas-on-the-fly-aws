import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import os
import emoji
import re
from datetime import datetime

class PostPerformancePredictor:
    def __init__(self):
        # Use RandomForest for classification
        self.model = RandomForestClassifier(
            n_estimators=200,
            max_depth=5,
            min_samples_split=5,
            class_weight='balanced',
            random_state=42
        )
        self.scaler = StandardScaler()
        self.feature_columns = [
            'content_length', 'hashtag_count', 'emoji_count', 'has_image',
            'post_time_hour', 'post_time_day', 'mentions_count', 'urls_count',
            'is_product_post', 'is_promotional', 'is_engagement_post', 'has_price',
            'has_hashtags', 'has_mentions', 'is_weekend', 'is_business_hours',
            'hashtag_with_image', 'length_per_hashtag'
        ]
        self.model_path = os.path.join(os.path.dirname(__file__), 'models')
        os.makedirs(self.model_path, exist_ok=True)

    def load_model(self, model_path):
        """Load trained model and scaler"""
        try:
            # Get the base path and model name
            base_dir = os.path.dirname(model_path)
            model_name = os.path.basename(model_path)
            
            # Extract timestamp from model name (e.g., model_20250722_212611.joblib -> 20250722_212611)
            timestamp = '_'.join(model_name.split('_')[1:]).replace('.joblib', '')
            
            # Load model
            print(f"Loading model from: {model_path}")
            self.model = joblib.load(model_path)
            
            # Load corresponding scaler with full timestamp
            scaler_path = os.path.join(base_dir, f'scaler_{timestamp}.joblib')
            print(f"Looking for scaler at: {scaler_path}")
            
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
                print(f"Loaded model and scaler successfully")
                return True
            else:
                raise FileNotFoundError(f"Could not find scaler file: {scaler_path}")
                
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            raise

    def extract_features_from_content(self, content, scheduled_time=None):
        """Extract features from content text"""
        # Basic text features
        features = {
            'content_length': len(content),
            'hashtag_count': len(re.findall(r'#\w+', content)),
            'emoji_count': len([c for c in content if c in emoji.EMOJI_DATA]),
            'mentions_count': len(re.findall(r'@\w+', content)),
            'urls_count': len(re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', content))
        }
        
        # Content type features
        features.update({
            'is_product_post': 1 if any(word in content.lower() for word in ['buy', 'shop', 'purchase', 'order', 'collection']) else 0,
            'is_promotional': 1 if any(word in content.lower() for word in ['sale', 'discount', 'offer', 'deal', 'save']) else 0,
            'is_engagement_post': 1 if any(word in content.lower() for word in ['follow', 'like', 'share', 'comment', 'tag']) else 0,
            'has_price': 1 if bool(re.search(r'[\$€£]\d+', content)) else 0
        })
        
        # Time features
        if scheduled_time:
            post_time = scheduled_time
        else:
            post_time = datetime.now()
            
        features.update({
            'post_time_hour': post_time.hour,
            'post_time_day': post_time.weekday()
        })
        
        return features
        
    def get_engagement_category(self, rate):
        """Convert engagement rate to category"""
        if rate < 0.002:  # < 0.002% (bottom 25%)
            return 'low'
        elif rate < 0.005:  # 0.002% - 0.005% (middle 50%)
            return 'medium'
        else:  # > 0.005% (top 25%)
            return 'high'

    def get_feature_weights(self):
        """Get feature importance weights to emphasize content quality over timing"""
        weights = {
            'content_length': 1.8,        # Increased from 1.5
            'hashtag_count': 1.4,         # Increased from 1.2
            'emoji_count': 0.8,           # Keep as is
            'has_image': 1.5,             # Increased from 1.3
            'post_time_hour': 0.4,        # Reduced from 0.6
            'post_time_day': 0.4,         # Reduced from 0.6
            'mentions_count': 1.0,        # Keep as is
            'urls_count': 0.7,            # Keep as is
            'is_product_post': 1.4,       # Increased from 1.2
            'is_promotional': 0.9,        # Keep as is
            'is_engagement_post': 1.8,    # Increased from 1.4
            'has_price': 0.8,             # Keep as is
            'has_hashtags': 0.7,          # Keep as is
            'has_mentions': 0.7,          # Keep as is
            'is_weekend': 0.4,            # Reduced from 0.6
            'is_business_hours': 0.4,     # Reduced from 0.6
            'hashtag_with_image': 1.4,    # Increased from 1.1
            'length_per_hashtag': 1.6     # Increased from 1.2
        }
        return weights

    def train(self, training_data_path):
        """Train the model on collected data"""
        # Load the training data
        df = pd.read_csv(training_data_path)
        
        # Add engagement categories
        df['engagement_category'] = df['engagement_rate'].apply(self.get_engagement_category)
        
        # Print distribution of categories
        print("\nEngagement Category Distribution:")
        print(df['engagement_category'].value_counts())
        print("\nCategory Examples:")
        for category in ['low', 'medium', 'high']:
            examples = df[df['engagement_category'] == category].sample(min(3, len(df[df['engagement_category'] == category])))
            print(f"\n{category.upper()} Engagement Examples:")
            for _, example in examples.iterrows():
                print(f"Rate: {example['engagement_rate']:.4f}%, Content Length: {example['content_length']}, "
                      f"Hashtags: {example['hashtag_count']}, Likes: {example['favorite_count']}")
        
        # Add engineered features
        df['total_engagement'] = df['favorite_count'] + df['retweet_count'] + df['reply_count']
        df['has_hashtags'] = (df['hashtag_count'] > 0).astype(int)
        df['has_mentions'] = (df['mentions_count'] > 0).astype(int)
        df['is_weekend'] = (df['post_time_day'] >= 5).astype(int)
        df['is_business_hours'] = ((df['post_time_hour'] >= 9) & (df['post_time_hour'] <= 17)).astype(int)
        df['hashtag_with_image'] = df['hashtag_count'] * df['has_image']
        df['length_per_hashtag'] = df['content_length'] / (df['hashtag_count'] + 1)
        
        # Get feature weights
        feature_weights = self.get_feature_weights()
        
        # Prepare features and target
        X = df[self.feature_columns]
        y = df['engagement_category']
        
        # Split the data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale the features
        self.scaler.fit(X_train)
        X_train_scaled = self.scaler.transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Apply feature weights
        for i, feature in enumerate(self.feature_columns):
            weight = feature_weights.get(feature, 1.0)
            X_train_scaled[:, i] *= weight
            X_test_scaled[:, i] *= weight
        
        # Train the model with adjusted parameters
        self.model = RandomForestClassifier(
            n_estimators=300,          # Increased from 200
            max_depth=6,               # Increased from 5
            min_samples_split=4,       # Reduced from 5
            class_weight='balanced',
            random_state=42
        )
        self.model.fit(X_train_scaled, y_train)
        
        # Print performance metrics
        print("\nModel Performance:")
        y_pred = self.model.predict(X_test_scaled)
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        
        # Print confusion matrix
        print("\nConfusion Matrix:")
        conf_matrix = confusion_matrix(y_test, y_pred)
        print(conf_matrix)
        
        # Print example predictions
        print("\nExample Predictions:")
        for X_sample, y_true in zip(X_test_scaled[:5], y_test[:5]):
            pred = self.model.predict([X_sample])[0]
            proba = self.model.predict_proba([X_sample])[0]
            confidence = max(proba) * 100
            print(f"Predicted: {pred} (Confidence: {confidence:.1f}%), Actual: {y_true}")
        
        # Save the model and scaler
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        model_filename = f'model_{timestamp}.joblib'
        scaler_filename = f'scaler_{timestamp}.joblib'
        
        joblib.dump(self.model, os.path.join(self.model_path, model_filename))
        joblib.dump(self.scaler, os.path.join(self.model_path, scaler_filename))
        
        # Save feature importance analysis (with weights applied)
        weighted_importance = self.model.feature_importances_ * [feature_weights.get(f, 1.0) for f in self.feature_columns]
        weighted_importance = weighted_importance / weighted_importance.sum()  # Renormalize
        
        feature_importance = pd.DataFrame({
            'feature': self.feature_columns,
            'importance': weighted_importance
        }).sort_values('importance', ascending=False)
        
        # Remove any duplicate features before saving
        feature_importance = feature_importance.drop_duplicates(subset=['feature'], keep='first')
        
        feature_importance.to_csv(
            os.path.join(self.model_path, f'feature_importance_{timestamp}.csv'),
            index=False
        )
        
        print("\nFeature Importance (with weights applied):")
        for feature in feature_importance.itertuples():
            print(f"{feature.feature}: {feature.importance:.4f}")
        
        return feature_importance.to_dict('records')
    
    def predict(self, content, has_image=False, scheduled_time=None):
        """Predict engagement category for new content"""
        # Extract features
        features = self.extract_features_from_content(content, scheduled_time)
        features['has_image'] = 1 if has_image else 0
        
        # Add engineered features
        features['has_hashtags'] = 1 if features['hashtag_count'] > 0 else 0
        features['has_mentions'] = 1 if features['mentions_count'] > 0 else 0
        features['is_weekend'] = 1 if features['post_time_day'] >= 5 else 0
        features['is_business_hours'] = 1 if 9 <= features['post_time_hour'] <= 17 else 0
        features['hashtag_with_image'] = features['hashtag_count'] * features['has_image']
        features['length_per_hashtag'] = features['content_length'] / (features['hashtag_count'] + 1)
        
        # Convert to DataFrame and select features
        X = pd.DataFrame([features])[self.feature_columns]
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        # Get prediction and probabilities
        category = self.model.predict(X_scaled)[0]
        probabilities = self.model.predict_proba(X_scaled)[0]
        
        # Get feature importance for this prediction
        feature_importance = dict(zip(
            self.feature_columns,
            self.model.feature_importances_
        ))
        
        # Get top contributing features
        top_features = sorted(
            feature_importance.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]
        
        # Get confidence for the predicted category
        category_index = {'low': 0, 'medium': 1, 'high': 2}[category]
        confidence = float(probabilities[category_index]) * 100

        return {
            'category': category,  # Changed from predicted_category to match what the route expects
            'confidence': confidence,  # Single confidence score for the predicted category
            'feature_importance': dict(top_features)  # Simplified feature importance format
        }

if __name__ == "__main__":
    predictor = PostPerformancePredictor()
    
    # Train the model if training data exists
    latest_training_file = None
    training_data_dir = 'training_data'
    
    if os.path.exists(training_data_dir):
        files = [f for f in os.listdir(training_data_dir) if f.startswith('processed_features_')]
        if files:
            latest_training_file = os.path.join(
                training_data_dir,
                sorted(files)[-1]  # Get the most recent file
            )
    
    if latest_training_file:
        print(f"Training model using {latest_training_file}")
        predictor.train(latest_training_file)
    else:
        print("No training data found. Please run collect_training_data.py first.")
