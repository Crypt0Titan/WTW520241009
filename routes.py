import datetime  # This allows the usage of datetime.datetime.now() and datetime.timedelta()
from datetime import timedelta, timezone  # timedelta is specifically imported to handle time differences
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, session
from models import Game, Player, Question, Admin
from forms import CreateGameForm, JoinGameForm
from extensions import db, socketio
from werkzeug.security import check_password_hash
from sqlalchemy.orm import joinedload
from sqlalchemy import func
from utils import make_aware, calculate_game_statistics  # Import utility functions
from logging import getLogger


# Initialize logger
logger = getLogger(__name__)

# Function to update game statuses
def update_game_statuses():
    current_time = datetime.datetime.now(datetime.timezone.utc)  # Make sure current time is timezone-aware (UTC)

    games = Game.query.all()

    for game in games:
        try:
            # Convert start_time and end_time to timezone-aware UTC if not already
            if game.start_time and game.start_time.tzinfo is None:
                game.start_time = game.start_time.replace(tzinfo=datetime.timezone.utc)
            if game.end_time is None and game.time_limit:  # Ensure end_time is set
                game.end_time = game.start_time + datetime.timedelta(seconds=game.time_limit)
            elif game.end_time and game.end_time.tzinfo is None:
                game.end_time = game.end_time.replace(tzinfo=datetime.timezone.utc)

            # Start the game if current time has passed the start time
            if current_time >= game.start_time and not game.has_started:
                game.has_started = True
                db.session.commit()
                socketio.emit('game_updated', {'game_id': game.id, 'status': 'started'}, namespace='/game')

            # Complete the game if current time has passed the end time
            if game.end_time and current_time >= game.end_time and not game.is_complete:
                game.is_complete = True
                db.session.commit()
                socketio.emit('game_updated', {'game_id': game.id, 'status': 'completed'}, namespace='/game')

        except Exception as e:
            print(f"Error updating game ID {game.id}: {e}")
            db.session.rollback()



# Blueprint creation for routes
def create_routes():
    main = Blueprint('main', __name__)
    admin = Blueprint('admin', __name__, url_prefix='/admin')

    # Main index route
    @main.route('/')
    def index():
        default_statistics = {
            'total_games': 0,
            'total_rewards': 0,
            'total_players': 0,
            'total_time': 0,
            'avg_time_per_game': 0,
            'avg_earnings_per_winner': 0
        }  # Define default_statistics at the start

        try:
            update_game_statuses()
            games = Game.query.filter_by(is_complete=False).options(joinedload(Game.players)).order_by(Game.start_time).all()
            for game in games:
                game.start_time = make_aware(game.start_time)
                if game.end_time:
                    game.end_time = make_aware(game.end_time)
                game.start_time_iso = game.start_time.isoformat()
            statistics = calculate_game_statistics()  # Ensure this call works
            return render_template('index.html', games=games, len=len, now=datetime.datetime.now(datetime.timezone.utc), statistics=statistics)
        except Exception as e:
            logger.error(f"Error updating game statuses or querying games: {str(e)}")
            return render_template('index.html', games=[], len=len, now=datetime.datetime.now(datetime.timezone.utc), statistics=default_statistics)



    # Lobby route
    @main.route('/game/<int:game_id>/lobby', methods=['GET', 'POST'])
    def game_lobby(game_id):
        game = Game.query.get_or_404(game_id)
        game.start_time = make_aware(game.start_time)
        players = Player.query.filter_by(game_id=game.id).all()

        # Redirect to play page if game has started
        current_time = datetime.datetime.now(timezone.utc)
        if game.has_started or current_time >= game.start_time:
            return redirect(url_for('main.play_game', game_id=game.id))

        # Wallet connection only
        if request.method == 'POST':
            data = request.get_json()
            ethereum_address = data.get('ethereum_address')

            if not ethereum_address:
                return jsonify({'success': False, 'message': 'Ethereum address is required.'}), 400

            # Check if the player already exists for this game
            existing_player = Player.query.filter_by(game_id=game.id, ethereum_address=ethereum_address).first()

            if not existing_player:
                # Add new player to the game
                new_player = Player(game_id=game.id, ethereum_address=ethereum_address)
                db.session.add(new_player)
                db.session.commit()

                # Emit an event to update the player count on the frontend
                socketio.emit('player_joined', {'game_id': game.id, 'player_count': len(players) + 1}, namespace='/game')

            # Store Ethereum address in session
            session['ethereum_address'] = ethereum_address
            return jsonify({'success': True, 'message': 'Wallet connected successfully!'}), 200

        return render_template('game/lobby.html', game=game, players=players)


    # Play game route
    @main.route('/game/<int:game_id>/play', methods=['GET', 'POST'])
    def play_game(game_id):
        game = Game.query.get_or_404(game_id)
        logger.info(f"Fetching game with ID: {game_id}")

        # Corrected datetime usage
        current_time = datetime.datetime.now(datetime.timezone.utc)
        game_start_time = make_aware(game.start_time)

        # Check if the game has started or not
        if game_start_time > current_time:
            flash('The game has not started yet.', 'warning')
            return redirect(url_for('main.game_lobby', game_id=game.id))

        # Check if the game is complete
        if game.is_complete:
            flash('This game has already ended.', 'info')
            return redirect(url_for('main.game_result', game_id=game.id))

        # Start the game if it hasn't started yet
        if not game.has_started:
            game.has_started = True
            db.session.commit()
            socketio.emit('game_started', {'game_id': game.id}, namespace='/game')

        # Check for Ethereum address in session
        ethereum_address = session.get('ethereum_address')
        if not ethereum_address:
            flash('You need to join the game first.', 'warning')
            return redirect(url_for('main.game_lobby', game_id=game.id))

        # Fetch questions and players for the game
        questions = Question.query.filter_by(game_id=game.id).all()
        players = Player.query.filter_by(game_id=game_id).order_by(Player.score.desc()).all()

        # Handle form submission
        if request.method == 'POST':
            answers = request.form.getlist('answers[]')
            player = Player.query.filter_by(game_id=game.id, ethereum_address=ethereum_address).first()

            if player:
                # Calculate the player's score
                score = sum(1 for q, a in zip(questions, answers) if q.answer.lower() == a.lower())
                player.score = score
                db.session.commit()

                # Emit updated score via socket
                socketio.emit('player_score_update', {
                    'game_id': game.id,
                    'player_address': ethereum_address,
                    'score': score
                }, namespace='/game')

                # Redirect to the game result page
                return redirect(url_for('main.game_result', game_id=game.id))
            else:
                flash('Player not found. Please rejoin the game.', 'error')
                return redirect(url_for('main.game_lobby', game_id=game.id))

        # Render the play page with questions and players
        return render_template('game/play.html', game=game, questions=questions, player_address=ethereum_address, players=players)



    # Game result route
    @main.route('/game/<int:game_id>/result')
    def game_result(game_id):
        game = Game.query.get_or_404(game_id)
        players = Player.query.filter_by(game_id=game_id).order_by(Player.score.desc(), Player.joined_at).all()

        score = request.args.get('score', type=int)
        ethereum_address = request.args.get('ethereum_address', '')

        # Clear session Ethereum address
        session.pop('ethereum_address', None)

        return render_template('game/results.html', game=game, players=players, score=score, ethereum_address=ethereum_address)

    # Submit answers route
    @main.route('/game/<int:game_id>/submit', methods=['POST'])
    def submit_answers(game_id):
        try:
            game = Game.query.get_or_404(game_id)
            answers = request.form.getlist('answers[]')
            ethereum_address = session.get('ethereum_address', request.form.get('ethereum_address'))

            if not answers:
                return jsonify({'success': False, 'message': 'No answers provided.'}), 400
            if not ethereum_address:
                return jsonify({'success': False, 'message': 'Ethereum address required.'}), 400

            current_time = datetime.datetime.now(datetime.timezone.utc)

            if game.end_time is None and game.start_time and game.time_limit:
                game.start_time = make_aware(game.start_time)
                game.end_time = game.start_time + datetime.timedelta(seconds=game.time_limit)
                db.session.commit()
            else:
                game.end_time = make_aware(game.end_time)

            if game.end_time and current_time >= game.end_time:
                return jsonify({'success': False, 'message': 'The game has already ended.', 
                                'redirect_url': url_for('main.game_result', game_id=game.id, ethereum_address=ethereum_address)}), 200

            # Calculate score
            score = 0
            questions = Question.query.filter_by(game_id=game.id).all()
            for question, answer in zip(questions, answers):
                if answer.strip().lower() == question.answer.strip().lower():
                    score += 1

            # Update or create player score
            player = Player.query.filter_by(ethereum_address=ethereum_address, game_id=game.id).first()
            if player:
                player.score = score
            else:
                player = Player(ethereum_address=ethereum_address, game_id=game.id, score=score)
                db.session.add(player)

            db.session.commit()

            socketio.emit('player_score_update', {'game_id': game.id, 'player_address': ethereum_address, 'score': score}, namespace='/game')

            return jsonify({'success': True, 'redirect_url': url_for('main.game_result', game_id=game.id, score=score, ethereum_address=ethereum_address)}), 200

        except Exception as e:
            print(f"Error in submit_answers: {str(e)}")
            return jsonify({'success': False, 'message': 'An error occurred while submitting answers. Please try again later.'}), 500

    @admin.route('/dashboard')
    def dashboard():
        try:
            # Update game statuses before fetching the games
            update_game_statuses()

            # Fetch all games ordered by creation date
            games = Game.query.order_by(Game.created_at.desc()).all()
            current_time = datetime.datetime.now(datetime.timezone.utc)  # Get the current time in UTC

            # Ensure the start_time is timezone-aware
            for game in games:
                game.start_time = make_aware(game.start_time)
                if game.end_time:
                    game.end_time = make_aware(game.end_time)

            # Render the admin dashboard
            return render_template('admin/dashboard.html', games=games, now=current_time)

        except Exception as e:
            logger.error(f"Error rendering dashboard: {str(e)}")
            # Return an empty list in case of error
            return render_template('admin/dashboard.html', games=[], now=datetime.datetime.now(datetime.timezone.utc))


    @admin.route('/start_game/<int:game_id>', methods=['POST'])
    def start_game(game_id):
        game = Game.query.get_or_404(game_id)
        if game.start_time and game.start_time <= datetime.datetime.now(datetime.timezone.utc):
            flash('Game has already started or is in progress!', 'error')
        else:
            game.start_time = datetime.datetime.now(datetime.timezone.utc)
            db.session.commit()
            flash(f'Game {game_id} has started!', 'success')
            socketio.emit('game_started', {'game_id': game.id}, namespace='/game')
        return redirect(url_for('admin.dashboard'))


    @admin.route('/create_game', methods=['GET', 'POST'])
    def create_game():
        form = CreateGameForm()
        logger.info("Create game route accessed")

        if request.method == 'POST':
            logger.info("POST request received")
            logger.info(f"Form data: {request.form}")
            logger.info(f"Start time data: {form.start_time.data}")

            if form.validate_on_submit():
                logger.info("Form validated successfully")
                try:
                    # Parse the start_time string into a datetime object
                    start_time_str = form.start_time.data
                    start_time = datetime.datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S")

                    # Ensure the start_time is in UTC
                    start_time_utc = start_time.replace(tzinfo=datetime.timezone.utc)
                    logger.info(f"Parsed start time (UTC): {start_time_utc}")

                    # Create the new game, making sure to set the `created_at` field
                    game = Game(
                        time_limit=form.time_limit.data,
                        max_players=form.max_players.data,
                        pot_size=form.pot_size.data,
                        entry_value=form.entry_value.data,
                        start_time=start_time_utc,
                        created_at=datetime.datetime.now(datetime.timezone.utc)  # Set the created_at field
                    )

                    # Set end_time using datetime.timedelta
                    game.end_time = game.start_time + datetime.timedelta(seconds=game.time_limit)

                    db.session.add(game)
                    db.session.commit()
                    logger.info(f"Game created with ID: {game.id}")

                    # Emit a socket event for game creation
                    socketio.emit('game_created', {'game_id': game.id}, namespace='/game')

                    # Add the questions
                    Question.query.filter_by(game_id=game.id).delete()  # Clear existing questions
                    for i in range(12):
                        phrase = getattr(form, f'phrase_{i}').data
                        answer = getattr(form, f'answer_{i}').data
                        if phrase and answer:
                            question = Question(game_id=game.id, phrase=phrase, answer=answer)
                            db.session.add(question)

                    db.session.commit()
                    logger.info("Questions added successfully")

                    # Return the success response or redirect to the dashboard
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return jsonify({'success': True, 'message': 'New game created successfully!', 'redirect': url_for('admin.dashboard')})
                    else:
                        flash('New game created successfully!', 'success')
                        return redirect(url_for('admin.dashboard'))

                except Exception as e:
                    logger.error(f"Error creating game: {str(e)}", exc_info=True)
                    db.session.rollback()  # Rollback the session in case of any error
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return jsonify({'success': False, 'message': f'An error occurred while creating the game: {str(e)}'})
                    else:
                        flash(f'An error occurred while creating the game: {str(e)}', 'error')
            else:
                logger.error("Form validation failed")
                for field, errors in form.errors.items():
                    for error in errors:
                        logger.error(f"Validation error in {field}: {error}")
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({'success': False, 'errors': form.errors})

        else:
            logger.info("GET request received")

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'message': 'Invalid request method'})

        return render_template('admin/create_game.html', form=form)



    @admin.route('/end_game/<int:game_id>', methods=['POST'])
    def end_game(game_id):
        game = Game.query.get_or_404(game_id)
        if not game.is_complete:
            game.is_complete = True
            db.session.commit()
            flash(f'Game {game_id} has been ended successfully.', 'success')
        else:
            flash(f'Game {game_id} is already completed.', 'info')
        return redirect(url_for('admin.dashboard'))

    @admin.route('/game_stats/<int:game_id>')
    def game_stats(game_id):
        game = Game.query.get_or_404(game_id)
        players = Player.query.filter_by(game_id=game_id).order_by(Player.score.desc()).all()
        return render_template('admin/game_stats.html', game=game, players=players)

    @admin.route('/login', methods=['GET', 'POST'])
    def admin_login():
        if request.method == 'POST':
            username = request.form['username']
            password = request.form['password']
            admin_user = Admin.query.filter_by(username=username).first()
            if admin_user and check_password_hash(admin_user.password_hash, password):
                session['admin_id'] = admin_user.id
                flash('Logged in successfully.', 'success')
                return redirect(url_for('admin.dashboard'))
            flash('Invalid username or password.', 'error')
        return render_template('admin/login.html')

    @admin.route('/logout')
    def admin_logout():
        session.pop('admin_id', None)
        flash('Logged out successfully.', 'success')
        return redirect(url_for('main.index'))
    return main, admin


# The blueprints are now created and returned by the create_routes function
# They should be registered in app.py
