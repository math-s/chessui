from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
import chess
import json
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class GameState(Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    CHECKMATE = "checkmate"
    DRAW = "draw"

@dataclass
class Game:
    board: chess.Board
    state: GameState
    white_player: Optional[WebSocket] = None
    black_player: Optional[WebSocket] = None
    move_history: List[str] = None

    def __post_init__(self):
        self.move_history = []

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Store active games
games: Dict[str, Game] = {}

def get_game_status(game: Game) -> str:
    if game.state == GameState.CHECKMATE:
        return "Game Over - Checkmate!"
    elif game.state == GameState.DRAW:
        return "Game Over - Draw!"
    elif game.board.is_check():
        return "Check!"
    else:
        return "White to move" if game.board.turn == chess.WHITE else "Black to move"

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    await websocket.accept()

    if game_id not in games:
        games[game_id] = Game(
            board=chess.Board(),
            state=GameState.WAITING
        )

    game = games[game_id]
    
    try:
        # Determine player color
        is_white = game.white_player is None
        if is_white:
            game.white_player = websocket
        else:
            game.black_player = websocket
            game.state = GameState.PLAYING
            # Notify both players that the game has started
            await game.white_player.send_json({
                "type": "game_start",
                "color": "white",
                "fen": game.board.fen()
            })
            await game.black_player.send_json({
                "type": "game_start",
                "color": "black",
                "fen": game.board.fen()
            })

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message["type"] == "move":
                try:
                    move = chess.Move.from_uci(message["move"])
                    if move in game.board.legal_moves:
                        game.board.push(move)
                        game.move_history.append(move.uci())
                        
                        # Update game state
                        if game.board.is_checkmate():
                            game.state = GameState.CHECKMATE
                        elif game.board.is_stalemate() or game.board.is_insufficient_material():
                            game.state = GameState.DRAW

                        # Send move to both players
                        for player in [game.white_player, game.black_player]:
                            if player:
                                await player.send_json({
                                    "type": "move",
                                    "move": move.uci(),
                                    "fen": game.board.fen(),
                                    "status": get_game_status(game),
                                    "move_history": game.move_history
                                })
                except ValueError:
                    # Invalid move
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid move"
                    })

    except WebSocketDisconnect:
        if is_white:
            game.white_player = None
        else:
            game.black_player = None
        
        # If no players left, remove the game
        if not game.white_player and not game.black_player:
            del games[game_id]
        # If one player left, notify the other
        else:
            remaining_player = game.white_player or game.black_player
            if remaining_player:
                await remaining_player.send_json({
                    "type": "opponent_disconnected"
                })

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
