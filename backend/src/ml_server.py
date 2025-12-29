from flask import Flask
from flask_cors import CORS
from routes.ml_routes import ml_routes
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Register blueprints with the correct URL prefix
app.register_blueprint(ml_routes, url_prefix='/ml')  # Add url_prefix back

@app.route('/test', methods=['GET'])
def test():
    return {'message': 'ML server is running!'}

if __name__ == '__main__':
    logger.info('Starting ML server on port 5007...')
    logger.info('Test the server at: http://localhost:5007/test')
    app.run(port=5007, debug=True) 