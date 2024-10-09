document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('create-game-form');
    const submitButton = form.querySelector('button[type="submit"]');
    let isSubmitting = false;

    function validateField(field) {
        const value = field.value.trim();
        const fieldName = field.name;
        let errorMessage = '';

        const validations = {
            time_limit: {
                required: 'Time limit is required.',
                range: { min: 60, max: 3600, message: 'Time limit must be between 60 and 3600 seconds.' }
            },
            max_players: {
                required: 'Maximum number of players is required.',
                range: { min: 2, max: 100, message: 'Number of players must be between 2 and 100.' }
            },
            pot_size: {
                required: 'Pot size is required.',
                min: { value: 1, message: 'Pot size must be at least 1.' }
            },
            entry_value: {
                required: 'Entry value is required.',
                min: { value: 0, message: 'Entry value must be at least 0.' }
            },
            start_time: {
                required: 'Start time is required.',
                future: 'Start time must be in the future.',
                format: 'Start time must be in the format YYYY-MM-DD HH:MM:SS.'
            }
        };

        if (validations[fieldName]) {
            const rules = validations[fieldName];

            if (!value && rules.required) {
                errorMessage = rules.required;
            } else if (rules.range && (isNaN(value) || value < rules.range.min || value > rules.range.max)) {
                errorMessage = rules.range.message;
            } else if (rules.min && (isNaN(value) || value < rules.min.value)) {
                errorMessage = rules.min.message;
            } else if (fieldName === 'start_time') {
                // Validate the format of start_time (YYYY-MM-DD HH:MM:SS)
                const enteredTime = value;
                const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                if (!regex.test(enteredTime)) {
                    errorMessage = rules.format;
                } else {
                    const enteredDate = new Date(enteredTime.replace(' ', 'T'));
                    const currentTime = new Date();
                    if (enteredDate <= currentTime) {
                        errorMessage = rules.future;
                    }
                }
            }
        }

        displayError(field, errorMessage);
        return !errorMessage;
    }

    function displayError(field, message) {
        const errorElement = field.nextElementSibling;
        if (errorElement && errorElement.classList.contains('error-message')) {
            errorElement.textContent = message;
        }
    }

    function validateForm() {
        let isValid = true;
        const fields = form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            if (!validateField(field)) {
                isValid = false;
            }
        });
        return isValid;
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (isSubmitting) {
            console.log('Form is already being submitted');
            return;
        }
        if (validateForm()) {
            submitForm();
        }
    });

    function submitForm() {
        if (isSubmitting) return;
        isSubmitting = true;
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        const formData = new FormData(form);

        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('Game created successfully!');
                window.location.href = "/admin/dashboard";
            } else {
                throw new Error(data.message || "Failed to create game.");
            }
        })
        .catch(error => {
            console.error('Error in fetch:', error);
            alert('An error occurred while creating the game. Please try again.');
        })
        .finally(() => {
            isSubmitting = false;
            submitButton.disabled = false;
            submitButton.textContent = 'Create Game';
        });
    }

    form.addEventListener('input', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            validateField(e.target);
        }
    });
});
