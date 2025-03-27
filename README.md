# Chess Game with WebSocket

A real-time chess game application built with Python FastAPI, WebSocket, and HTMX.

## Features

- Real-time chess gameplay between two players
- WebSocket communication for instant move updates
- Beautiful chess board UI using chessboard.js
- Simple and intuitive interface

## Setup

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python main.py
```

4. Open your browser and navigate to `http://localhost:8000`

## How to Play

1. First player: Click "New Game" to create a new game
2. Second player: Click "Join Game" and enter the game ID shown to the first player
3. Start playing! White moves first

## Technologies Used

- Backend: Python FastAPI with WebSocket support
- Frontend: HTMX, chessboard.js
- Chess Engine: python-chess