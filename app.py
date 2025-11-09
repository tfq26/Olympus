from flask import Flask
from flask_cors import CORS
from mcp.monitor.routes import monitor_bp

app = Flask(__name__)

# Enable CORS for all routes (allow frontend to access backend)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

app.register_blueprint(monitor_bp, url_prefix="/monitor")

if __name__ == "__main__":
    app.run(debug=True)
