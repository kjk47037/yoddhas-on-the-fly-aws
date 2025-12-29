from flask import Blueprint, request, jsonify
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from ml.train import PostPerformancePredictor
import os

ml_routes = Blueprint('ml_routes', __name__)

# Initialize predictor
predictor = PostPerformancePredictor()
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
model_dir = os.path.join(base_dir, 'ml', 'models')
model_path = os.path.join(model_dir, 'model_20250722_212611.joblib')
print(f"Looking for model at: {model_path}")

# Verify paths
print(f"Base directory: {base_dir}")
print(f"Model directory: {model_dir}")
if not os.path.exists(model_dir):
    raise FileNotFoundError(f"Model directory not found: {model_dir}")
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Model file not found: {model_path}")
if os.path.exists(model_path):
    predictor.load_model(model_path)

@ml_routes.route('/predict', methods=['POST'])
def predict_performance():
    try:
        data = request.json
        content = data.get('content')
        has_image = data.get('has_image', False)
        scheduled_time = data.get('scheduled_time')

        if not content:
            return jsonify({'error': 'Content is required'}), 400

        prediction = predictor.predict(content, has_image, scheduled_time)
        
        return jsonify({
            'status': 'success',
            'prediction': prediction['category'],
            'confidence': prediction['confidence'],
            'feature_importance': prediction['feature_importance']
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ml_routes.route('/predict_batch', methods=['POST'])
def predict_batch_performance():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data received'}), 400
            
        posts = data.get('posts', [])
        print(f"Received batch prediction request for {len(posts)} posts")

        if not posts:
            return jsonify({'error': 'Posts array is required'}), 400

        predictions = []
        for idx, post in enumerate(posts):
            try:
                content = post.get('content')
                has_image = post.get('has_image', False)
                scheduled_time = post.get('scheduled_time')
                post_id = post.get('id')

                print(f"Processing post {idx + 1}/{len(posts)} with ID: {post_id}")

                if not content:
                    print(f"Warning: Empty content for post ID: {post_id}")
                    predictions.append({
                        'id': post_id,
                        'prediction': 'medium',
                        'confidence': 50,
                        'feature_importance': {}
                    })
                    continue

                prediction = predictor.predict(content, has_image, scheduled_time)
                predictions.append({
                    'id': post_id,
                    'prediction': prediction['category'],
                    'confidence': prediction['confidence'],
                    'feature_importance': prediction['feature_importance']
                })
                print(f"Successfully predicted for post ID: {post_id}")

            except Exception as e:
                print(f"Error processing post {idx + 1}: {str(e)}")
                predictions.append({
                    'id': post.get('id'),
                    'prediction': 'medium',
                    'confidence': 50,
                    'feature_importance': {}
                })

        print(f"Completed batch prediction for {len(predictions)} posts")
        return jsonify({
            'status': 'success',
            'predictions': predictions
        }), 200

    except Exception as e:
        print(f"Fatal error in batch prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500 