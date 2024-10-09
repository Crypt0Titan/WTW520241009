import os
import logging
from logging.handlers import RotatingFileHandler
import traceback
from datetime import datetime, timezone

import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, redirect, url_for, flash, request, jsonify
from flask_migrate import Migrate
from flask_cors import CORS

from extensions import db, socketio
from routes import create_routes
from forms import CreateGameForm
from models import Game

from utils import make_aware  # Correctly imported for timezone-aware functionality


# Create the Flask application
app = Flask(__name__)

# CORS configuration
CORS(app, resources={r"/*": {
    "origins": [
        "https://replit.com",
        "https://replit.com/@shegemsanad/WTW2-Game-Server",
        "https://15e5978f-2efe-40e8-8c8c-6bf6cd37298e-00-287zvg5sagp5p.sisko.replit.dev"
    ],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"]
}}, supports_credentials=True)

app.secret_key = "07e7d9d6-f9e5-4f4a-9d2d-b3f"
app.config["SECRET_KEY"] = app.secret_key
app.config['PREFERRED_URL_SCHEME'] = 'https'
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///test.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config['WTF_CSRF_ENABLED'] = False


# Database configuration
database_url = os.environ.get("DATABASE_URL", "sqlite:///test.db")
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
migrate = Migrate(app, db)
CORS(app, resources={r"/*": {"origins": ["https://replit.com", "https://replit.com/@shegemsanad/WTW2-Game-Server"]}}, supports_credentials=True)
socketio.init_app(app, async_mode='eventlet')

# Other configurations
app.config['WTF_CSRF_ENABLED'] = False
socketio.init_app(app, async_mode='eventlet')

# Create and register blueprints
main, admin = create_routes()
app.register_blueprint(main)
app.register_blueprint(admin, url_prefix='/admin')

# Create database tables
with app.app_context():
    db.create_all()

# Set up logging
if not app.debug:
    handler = RotatingFileHandler('error.log', maxBytes=10000, backupCount=1)
    handler.setLevel(logging.INFO)
    app.logger.addHandler(handler)


@app.context_processor
def inject_utils():
    return dict(now=datetime.now(timezone.utc), make_aware=make_aware)

# Routes
@app.route('/admin/dashboard')
def admin_dashboard():
    games = Game.query.order_by(Game.created_at.desc()).all()
    for game in games:
        game.start_time = make_aware(game.start_time)
    return render_template('admin/dashboard.html', games=games)

@app.route('/admin/create_game', methods=['GET', 'POST'])
def create_game():
    form = CreateGameForm()
    if request.method == 'POST':
            app.logger.info(f"Received POST request: {request.form}")
            if form.validate_on_submit():
                try:
                    game = Game(
                        time_limit=form.time_limit.data,
                        max_players=form.max_players.data,
                        pot_size=form.pot_size.data,
                        entry_value=form.entry_value.data,
                        start_time=make_aware(form.start_time.data)
                    )
                    db.session.add(game)
                    db.session.flush()  # This will assign an ID to the game

                    # Add questions
                    for i in range(12):  # Assuming 12 questions
                        phrase = getattr(form, f'phrase_{i}').data
                        answer = getattr(form, f'answer_{i}').data
                        if phrase and answer:
                            question = Question(game_id=game.id, phrase=phrase, answer=answer)
                            db.session.add(question)

                    db.session.commit()

                    app.logger.info(f"Game created successfully: {game.id}")
                    return jsonify({'success': True, 'message': 'Game created successfully!'}), 200
                except Exception as e:
                    db.session.rollback()
                    app.logger.error(f"Error creating game: {str(e)}")
                    app.logger.error(traceback.format_exc())
                    return jsonify({'success': False, 'message': f'Failed to create game: {str(e)}'}), 500
            else:
                app.logger.warning(f"Form validation failed: {form.errors}")
                return jsonify({'success': False, 'errors': form.errors}), 400
    return render_template('admin/create_game.html', form=form)

# Run the app
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
