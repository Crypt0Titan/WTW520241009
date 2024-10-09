from flask_wtf import FlaskForm
from wtforms import StringField, IntegerField, FloatField
from wtforms.validators import DataRequired, NumberRange, Length, ValidationError
from datetime import datetime, timezone  # Import timezone for proper handling of timezones


# Custom validator to check start time format
def validate_start_time(form, field):
    """Validate that start_time is in the correct format and is a future time."""
    try:
        # Parse the start_time string into a naive datetime object
        start_time = datetime.strptime(field.data, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise ValidationError("Start time must be in the format YYYY-MM-DD HH:MM:SS.")

    # Make start_time timezone-aware (UTC)
    start_time = start_time.replace(tzinfo=timezone.utc)

    # Ensure start_time is in the future (compare two timezone-aware datetime objects)
    if start_time <= datetime.now(timezone.utc):
        raise ValidationError("Start time must be in the future.")


class CreateGameForm(FlaskForm):
    time_limit = IntegerField('Time Limit (seconds)', validators=[
        DataRequired(message="Time limit is required."),
        NumberRange(min=60, max=3600, message="Time limit must be between 60 and 3600 seconds.")
    ])
    max_players = IntegerField('Max Players', validators=[
        DataRequired(message="Maximum number of players is required."),
        NumberRange(min=2, max=100, message="Number of players must be between 2 and 100.")
    ])
    pot_size = FloatField('Pot Size', validators=[
        DataRequired(message="Pot size is required."),
        NumberRange(min=1, message="Pot size must be at least 1.")
    ])
    entry_value = FloatField('Entry Value', validators=[
        DataRequired(message="Entry value is required."),
        NumberRange(min=0, message="Entry value must be at least 0.")
    ])
    start_time = StringField('Start Time (YYYY-MM-DD HH:MM:SS)', validators=[DataRequired(message="Start time is required."), validate_start_time])

    # Define phrase and answer fields for the game
    for i in range(12):
        locals()[f'phrase_{i}'] = StringField(f'Phrase {i+1}', validators=[Length(max=255)])
        locals()[f'answer_{i}'] = StringField(f'Answer {i+1}', validators=[Length(max=255)])

    def validate(self):
        """Override the validate method to include phrase-answer validation."""
        if not super().validate():
            return False

        # Ensure at least one phrase-answer pair is provided
        phrase_answer_pairs = [
            (getattr(self, f'phrase_{i}').data, getattr(self, f'answer_{i}').data) for i in range(12)
        ]
        valid_pairs = [pair for pair in phrase_answer_pairs if pair[0] and pair[1]]
        if len(valid_pairs) < 1:
            self.errors['phrases'] = ["At least one phrase-answer pair is required."]
            return False

        return True


class JoinGameForm(FlaskForm):
    ethereum_address = StringField('Ethereum Address', validators=[
        DataRequired(message="Ethereum address is required.")
    ])
