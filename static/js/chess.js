let board = null;
let ws = null;
let gameId = null;
let playerColor = null;
let pendingFen = null;
let game = new Chess(); // Add Chess.js game instance

function onDragStart(source, piece, position, orientation) {
    // Only allow dragging if it's the player's turn
    if (playerColor === null) return false;
    if ((playerColor === 'white' && piece.search(/^b/) !== -1) || 
        (playerColor === 'black' && piece.search(/^w/) !== -1)) return false;
    return true;
}

function onDrop(source, target, piece, newPos, oldPos, orientation) {
    // If source and target are the same, don't send the move
    if (source === target) {
        return 'snapback';
    }

    // Check if the move is legal
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Always promote to queen for simplicity
    });

    // If the move is illegal, snapback
    if (move === null) {
        return 'snapback';
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'move',
            move: source + target
        }));
        // Don't snapback - let the piece stay where it was dropped
        return true;
    }
    // If WebSocket is not open, snapback
    return 'snapback';
}

function onSnapEnd() {
    if (board) {
        board.position(game.fen());
    }
}

function onMouseoverSquare(square, piece) {
    // Get list of possible moves for this square
    if (!piece) return;
    
    const moves = game.moves({
        square: square,
        verbose: true
    });

    // Exit if there are no moves available for this square
    if (moves.length === 0) return;

    // Highlight the square they moused over
    greySquare(square);

    // Highlight possible moves for this square
    for (let i = 0; i < moves.length; i++) {
        greySquare(moves[i].to);
    }
}

function onMouseoutSquare(square, piece) {
    removeGreySquares();
}

function greySquare(square) {
    // Get the DOM element of the square
    const element = document.querySelector('.square-' + square);
    
    // Add the grey class
    element.classList.add('highlight');
}

function removeGreySquares() {
    const elements = document.getElementsByClassName('highlight');
    
    // Remove the grey class from all squares
    for (let i = 0; i < elements.length; i++) {
        elements[i].classList.remove('highlight');
    }
}

function createNewGame() {
    gameId = Math.random().toString(36).substring(2, 8);
    document.getElementById('gameId').textContent = gameId;
    connectWebSocket();
}

function joinGame() {
    gameId = prompt('Enter game ID:');
    if (gameId) {
        document.getElementById('gameId').textContent = gameId;
        connectWebSocket();
    }
}

function updateMoveHistory(moveHistory) {
    const moveList = document.getElementById('moveList');
    moveList.innerHTML = '';
    
    for (let i = 0; i < moveHistory.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const moveEntry = document.createElement('div');
        moveEntry.className = 'move-entry';
        moveEntry.textContent = `${moveNumber}. ${moveHistory[i]}${moveHistory[i + 1] ? ' ' + moveHistory[i + 1] : ''}`;
        moveList.appendChild(moveEntry);
    }
    moveList.scrollTop = moveList.scrollHeight;
}

function showBoard() {
    const boardElement = document.getElementById('board');
    boardElement.style.display = 'block';
    // Force a redraw of the board
    if (board && pendingFen) {
        board.position(pendingFen);
        pendingFen = null;
    }
}

function connectWebSocket() {
    console.log('Connecting to WebSocket...');
    ws = new WebSocket(`ws://${window.location.host}/ws/${gameId}`);
    
    ws.onmessage = function(event) {
        console.log('Received message:', event.data);
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'game_start':
                playerColor = data.color;
                showBoard();
                document.getElementById('whitePlayer').style.display = playerColor === 'white' ? 'block' : 'none';
                document.getElementById('blackPlayer').style.display = playerColor === 'black' ? 'block' : 'none';
                document.getElementById('newGameBtn').style.display = 'none';
                document.getElementById('joinGameBtn').style.display = 'none';
                document.getElementById('status').textContent = 'Connected';
                document.getElementById('status').className = 'status-connected';
                
                // Set board orientation based on player color
                if (board) {
                    board.orientation(playerColor);
                    console.log('Board orientation set to:', playerColor);
                }
                
                if (board) {
                    console.log('Setting board position:', data.fen);
                    board.position(data.fen);
                    game.load(data.fen); // Update the Chess.js game state
                } else {
                    console.log('Board not initialized yet, storing FEN');
                    pendingFen = data.fen;
                }
                break;
                
            case 'move':
                if (board) {
                    board.position(data.fen);
                    game.load(data.fen); // Update the Chess.js game state
                } else {
                    pendingFen = data.fen;
                }
                // Update game status and move history
                document.getElementById('gameStatus').textContent = data.status;
                updateMoveHistory(data.move_history);
                break;
                
            case 'error':
                alert(data.message);
                break;
                
            case 'opponent_disconnected':
                document.getElementById('status').textContent = 'Opponent disconnected';
                document.getElementById('status').className = 'status-disconnected';
                document.getElementById('board').style.display = 'none';
                document.getElementById('whitePlayer').style.display = 'none';
                document.getElementById('blackPlayer').style.display = 'none';
                document.getElementById('newGameBtn').style.display = 'inline-block';
                document.getElementById('joinGameBtn').style.display = 'inline-block';
                break;
        }
    };

    ws.onclose = function() {
        console.log('WebSocket disconnected');
        document.getElementById('status').textContent = 'Disconnected';
        document.getElementById('status').className = 'status-disconnected';
        document.getElementById('board').style.display = 'none';
        document.getElementById('whitePlayer').style.display = 'none';
        document.getElementById('blackPlayer').style.display = 'none';
        document.getElementById('newGameBtn').style.display = 'inline-block';
        document.getElementById('joinGameBtn').style.display = 'inline-block';
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

// Initialize the board configuration
const config = {
    draggable: true,
    position: 'start',
    orientation: 'white', // Default orientation, will be updated when player color is assigned
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    onMouseoverSquare: onMouseoverSquare,
    onMouseoutSquare: onMouseoutSquare,
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    showNotation: true,
    animationDuration: 150,        // Reduced from 300 to 150ms for faster movement
    moveSpeed: 'fast',            // Changed from 'slow' to 'fast' for quicker movement
    snapbackSpeed: 200,          // Reduced from 800 to 200ms for faster snapback
    snapSpeed: 100,              // Reduced from 200 to 100ms for faster snapping
    appearSpeed: 100,            // Reduced from 200 to 100ms for faster piece appearance
    disappearSpeed: 100,         // Reduced from 200 to 100ms for faster piece disappearance
    trashSpeed: 50,              // Reduced from 100 to 50ms for faster piece removal
    showErrors: 'console'        // Keep error logging for debugging
};

// Function to initialize the board
function initializeBoard() {
    console.log('Checking dependencies...');
    if (typeof Chessboard === 'undefined') {
        console.error('Chessboard.js not loaded');
        return;
    }
    if (typeof Chess === 'undefined') {
        console.error('Chess.js not loaded');
        return;
    }
    
    console.log('Initializing board...');
    try {
        // Initialize the board
        board = Chessboard('board', config);
        console.log('Chessboard initialized successfully');

        // If we have a pending FEN, apply it
        if (pendingFen) {
            console.log('Applying pending FEN:', pendingFen);
            board.position(pendingFen);
            pendingFen = null;
        }
    } catch (error) {
        console.error('Error initializing board:', error);
    }
    showBoard();
}

initializeBoard();
