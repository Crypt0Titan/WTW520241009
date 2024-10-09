        document.addEventListener('DOMContentLoaded', function() {
            const isPlayGamePage = document.getElementById('answer-form');
            const isLobbyPage = document.getElementById('join-game-form') || document.getElementById('countdown');

            if (isPlayGamePage) {
                initializePlayGame();
            } else if (isLobbyPage) {
                initializeLobby();
            }
        });

        function initializePlayGame() {
            const form = document.getElementById('answer-form');
            const countdownElement = document.getElementById('countdown');
            const endTimeStr = countdownElement.getAttribute('data-end-time');
            const gameId = parseInt(form.dataset.gameId);
            const playerAddress = form.dataset.playerAddress;

            if (!endTimeStr) {
                console.error('Game end time not provided.');
                return;
            }

            const endTime = new Date(endTimeStr);
            let timer;

            function startTimer() {
                function updateCountdown() {
                    const now = new Date();
                    const timeLeft = endTime - now;

                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        submitAnswers();
                    } else {
                        const minutes = Math.floor(timeLeft / 60000);
                        const seconds = Math.floor((timeLeft % 60000) / 1000);
                        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        countdownElement.textContent = formattedTime;
                    }
                }

                updateCountdown();
                timer = setInterval(updateCountdown, 1000);
            }

            function submitAnswers() {
                const formData = new FormData(form);

                fetch(form.action, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Server error: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        window.location.href = data.redirect_url;
                    } else {
                        alert(data.message || "An error occurred while submitting your answers.");
                        if (data.redirect_url) {
                            window.location.href = data.redirect_url;
                        }
                    }
                })
                .catch(error => {
                    console.error('Error in submitAnswers:', error);
                    alert('An error occurred while submitting answers. Please try again.');
                });
            }

            startTimer();

            form.addEventListener('submit', function(event) {
                event.preventDefault();
                clearInterval(timer);
                submitAnswers();
            });
        }

        function initializeLobby() {
            const gameId = parseInt(document.getElementById('game-id').value);
            const countdownElement = document.getElementById('countdown');
            let timer;

            function updateLobbyCountdown() {
                const startTimeStr = countdownElement.dataset.startTime;

                if (!startTimeStr) {
                    console.error('Game start time is not set.');
                    return;
                }

                const startTime = new Date(startTimeStr);
                const now = new Date();
                const timeLeft = startTime - now;

                if (timeLeft <= 0) {
                    clearInterval(timer);
                    window.location.href = `/game/${gameId}/play`;
                } else {
                    const minutes = Math.floor(timeLeft / 60000);
                    const seconds = Math.floor((timeLeft % 60000) / 1000);
                    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                    countdownElement.textContent = formattedTime;
                }
            }

            updateLobbyCountdown();
            timer = setInterval(updateLobbyCountdown, 1000);

            const joinGameForm = document.getElementById('join-game-form');
            if (joinGameForm) {
                joinGameForm.addEventListener('submit', function(event) {
                    event.preventDefault();
                    const formData = new FormData(joinGameForm);

                    fetch(joinGameForm.action, {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Server error: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.success) {
                            const playerCountElement = document.getElementById('player-count');
                            if (playerCountElement && data.player_count) {
                                playerCountElement.textContent = data.player_count;
                            }
                            alert('Successfully joined the game!');
                            window.location.reload();
                        } else {
                            throw new Error(data.message || 'Failed to join the game.');
                        }
                    })
                    .catch(error => {
                        console.error('Error in joinGame:', error);
                        alert(error.message || 'An error occurred. Please try again.');
                    });
                });
            }

            initializeSocket(gameId);
        }

        function initializeSocket(gameId) {
            if (typeof io !== 'undefined') {
                const socket = io('/game');

                socket.on('connect', function() {
                    console.log('Connected to game namespace');
                });

                socket.on('game_started', function(data) {
                    if (data.game_id === gameId) {
                        console.log('Game started event received.');
                        window.location.href = `/game/${gameId}/play`;
                    }
                });

                socket.on('connect_error', function(error) {
                    console.error('Connection error:', error);
                });
            } else {
                console.error('Socket.io is not available');
            }
        }