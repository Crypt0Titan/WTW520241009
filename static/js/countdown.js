document.addEventListener('DOMContentLoaded', function() {
    // Function to initialize countdowns for all games
    function initializeCountdowns() {
        const countdownElements = document.querySelectorAll('.countdown');

        countdownElements.forEach(startTimeElement => {
            const startTimeStr = startTimeElement.dataset.startTime;
            const gameId = startTimeElement.dataset.gameId;

            if (!startTimeStr) {
                console.error('Start time is not set for game ID:', gameId);
                return; // Exit if the countdown element does not have a start time
            }

            const startTime = new Date(startTimeStr);
            if (isNaN(startTime)) {
                console.error('Invalid start time for game ID:', gameId, startTimeStr);
                return;
            }

            const timer = setInterval(() => {
                const now = new Date();
                const timeLeft = startTime - now;

                if (timeLeft <= 0) {
                    clearInterval(timer);
                    startTimeElement.textContent = "Game has started!";
                    // Redirect to the game page when the countdown ends
                    window.location.href = `/game/${gameId}/play`; // Adjust this URL as necessary
                } else {
                    const minutes = Math.floor(timeLeft / 60000);
                    const seconds = Math.floor((timeLeft % 60000) / 1000);
                    startTimeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }, 1000);
        });
    }

    // Initialize countdowns for all games
    initializeCountdowns();
});
