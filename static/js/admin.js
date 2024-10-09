document.addEventListener('DOMContentLoaded', function () {
    initializeAdminPanel();
});

function initializeAdminPanel() {
    setupGameActions();
    setupRealTimeUpdates();
    setupDataRefresh();
}

function setupGameActions() {
    // Event delegation for game actions
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('end-game-btn')) {
            handleEndGame(event);
        }
        // Add more action handlers here as needed
    });
}

function handleEndGame(event) {
    const gameId = event.target.dataset.gameId;
    if (!confirm(`Are you sure you want to end Game #${gameId}?`)) return;

    fetch(`/admin/end_game/${gameId}`, {
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(data.message);
            location.reload(); // Refresh the page to show updated game status
        } else {
            throw new Error(data.message || 'Failed to end the game');
        }
    })
    .catch(error => {
        console.error('Error ending game:', error);
        alert('An error occurred while ending the game. Please try again.');
    });
}

function setupRealTimeUpdates() {
    if (typeof io !== 'undefined') {
        const socket = io('/admin');

        socket.on('connect', function() {
            console.log('Connected to admin namespace');
        });

        socket.on('game_updated', function(data) {
            updateGameRow(data);
        });

        socket.on('new_game_created', function(data) {
            addNewGameRow(data);
        });

        socket.on('connect_error', function(error) {
            console.error('Socket connection error:', error);
        });
    } else {
        console.warn('Socket.io is not available. Real-time updates are disabled.');
    }
}

function updateGameRow(gameData) {
    const row = document.querySelector(`tr[data-game-id="${gameData.id}"]`);
    if (row) {
        // Update row data based on gameData
        row.querySelector('.game-status').textContent = gameData.status;
        row.querySelector('.player-count').textContent = `${gameData.player_count} / ${gameData.max_players}`;
        // Update other fields as necessary
    }
}

function addNewGameRow(gameData) {
    const tableBody = document.querySelector('#games-table tbody');
    if (tableBody) {
        const newRow = createGameRow(gameData);
        tableBody.insertAdjacentHTML('afterbegin', newRow);
    }
}

function createGameRow(gameData) {
    // Create and return HTML for a new game row
    return `
        <tr data-game-id="${gameData.id}">
            <td>${gameData.id}</td>
            <td>${gameData.start_time}</td>
            <td>$${gameData.pot_size.toFixed(2)}</td>
            <td class="player-count">${gameData.player_count} / ${gameData.max_players}</td>
            <td class="game-status">${gameData.status}</td>
            <td>
                <a href="/admin/game_stats/${gameData.id}" class="text-blue-500 hover:underline">View Stats</a>
                ${gameData.status !== 'Completed' ? 
                    `<button class="end-game-btn neon-button text-white" data-game-id="${gameData.id}">End Game</button>` : 
                    ''}
            </td>
        </tr>
    `;
}

function setupDataRefresh() {
    // Periodically refresh data or setup refresh button
    const refreshButton = document.getElementById('refresh-data');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            location.reload();
        });
    }
}