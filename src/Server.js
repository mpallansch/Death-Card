import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import SSE from 'express-sse';
import multer from 'multer';

import { Game } from './shared/game';
import { Player } from './shared/player';
import { Chair } from './shared/chair';
import { GameState } from './shared/game-state';
import { GameDao } from './dao/game-dao';
import { PlayerDao } from './dao/player-dao';

class GameServer {
    static Players = new Array<Player>();
    static Games = new Array<Game>();

    static setupGame(numberOfPlayers: number, callback: (game: Game, result: boolean) => void): void {
        let newGame = new Game(numberOfPlayers);
        let dao = new GameDao();
        dao.create(newGame, (updatedGame: Game, result: boolean) => {
            if (result) {
                this.Games.push(newGame);
            }
            callback(newGame, result);
        });
    }

    static startGame(game: Game, callback: (updateGame: Game, result: boolean) => void): void {
        let theGames: Game[] = this.Games.filter((item: Game) => item.id === game.id);
        if (theGames && 1 === theGames.length) {
            let theGame = theGames[0];
            theGame.state = GameState.PREBIDDING;
            let dao = new GameDao();
            dao.update(theGame, (result: boolean) => {
                callback(theGame, result);
            });
        }
    }

    static endGame(game: Game, callback: (updateGame: Game, result: boolean) => void): void {
        this.Games.forEach((item: Game, index: number) => {
            if (item.id === game.id) {
                let theGame = this.Games[index];
                this.Games.splice(index, 1);
                theGame.state = GameState.FINISHED
                let dao = new GameDao();
                dao.update(theGame, (result: boolean) => {
                    callback(theGame, result);
                });
            }
        });
    }

}

const DEBUG: boolean = true;

const app = express();
const sse = new SSE();

const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer({}).any());
app.use(express.static('public'));
app.use(cookieParser());
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*'); // TODO, set this to be specific domains

    next();
});
app.use(session({ secret: "deathcard2deathcard" }));

app.use('/images', express.static(__dirname + '/public/images'));
app.use('/js', express.static(__dirname + '/public/js'));
app.use('/css', express.static(__dirname + '/public/css'));

let checkSignIn = function (username: string): Player {
    let player: Player;
    let findPlayer: Player[] = GameServer.Players.filter((player: Player) => player.username === username);
    console.log('findPlayer', findPlayer);
    if (findPlayer && 0 < findPlayer.length) {
        player = findPlayer[0];
    }
    console.log('after findPlayer player', player);
    if (player && player.authenticated) {
        console.log('Logged in!');
    } else {
        console.log('Not logged in!');
    }
    console.log('GameServer.Players', GameServer.Players);
    return player;
};

app.get('/', function (req: Request, res: Response) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    res.send({ status: 'OK', player: player, game: undefined });
});

app.get('/games', function (req: Request, res: Response) {
    let dao: GameDao = new GameDao();
    dao.all((result: Array<Game>) => {
        res.send({ status: 'OK', games: result });
    });
});

app.get('/players', function (req: Request, res: Response) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let dao: PlayerDao = new PlayerDao();
    dao.all((result: Array<Player>) => {
        res.send({ status: 'OK', players: result });
    });
});

const registerPlayer = function (req: Request, res: Response, username: string, password: string, passwordConfirm: string, displayName: string, emailAddress: string): void {
    console.log('registerPlayer', username, password, passwordConfirm, displayName, emailAddress);
    let newPlayer = checkSignIn(username);
    if (!username || !password || !passwordConfirm) {
        newPlayer.message = 'Please enter both id and password with password confirmation';
        res.send({ status: 'FAILED', player: newPlayer, game: undefined });
    } else {
        if (password === passwordConfirm) {
            let findPlayer: Player[] = GameServer.Players.filter((player: Player) => player.username === newPlayer.username);
            if (findPlayer || 0 < findPlayer.length) {
                console.log('attempting db update');
                newPlayer.username = username;
                newPlayer.password = password;
                newPlayer.displayName = displayName;
                newPlayer.emailAddress = emailAddress;
                let dao: PlayerDao = new PlayerDao();
                dao.registerPlayer(newPlayer, (updatedPlayer: Player, result: boolean) => {
                    if (result) {
                        console.log('db update ok');
                        res.send({ status: 'OK', player: updatedPlayer, game: undefined });
                    } else {
                        console.log('db update failed');
                        newPlayer.message = 'Failed to register player!  Please try again.';
                        res.send({ status: 'FAILED', player: updatedPlayer, game: undefined });
                    }
                });
            } else {
                newPlayer.message = 'Username has already been taken!  Please try a different username.';
                res.send({ status: 'FAILED', player: newPlayer, game: undefined });
            }
        } else {
            newPlayer.message = 'Passwords do not match!  Please try again.';
            res.send({ status: 'FAILED', player: newPlayer, game: undefined });
        }
    }
};

const logonPlayer = function (req: Request, res: Response, username: string, password: string) {
    let newPlayer: Player = checkSignIn(username);
    if ('undefined' === typeof newPlayer) {
        newPlayer = new Player(req.session.id);
    }
    if (!username || !password) {
        newPlayer.message = 'Please enter both id and password';
        res.send({ status: 'FAILED', player: newPlayer, game: undefined });
    } else {
        let dao: PlayerDao = new PlayerDao();
        dao.logonPlayer(username, password, req.session.id, (updatedPlayer: Player, result: boolean) => {
            newPlayer = updatedPlayer;
            if (updatedPlayer.authenticated && result) {
                console.log('Logon succeded!', newPlayer);
                let playerFound: boolean = false;
                GameServer.Players.map((player: Player, index: number) => {
                    if (player.username === newPlayer.username) {
                        player.authenticated = true;
                        playerFound = true;
                    }
                });
                if (!playerFound) {
                    GameServer.Players.push(newPlayer);
                }
                res.send({ status: 'OK', player: newPlayer, game: undefined });
            } else {
                newPlayer.message = 'Logon failed!';
                res.send({ status: 'FAILED', player: newPlayer, game: undefined });
            }
        });
    }
};

app.post('/register', function (req: Request, res: Response) {
    let username: string = req.body.username as string;
    let password: string = req.body.password as string;
    let passwordConfirm: string = req.body.passwordConfirm as string;
    let displayName: string = req.body.displayName as string;
    let emailAddress: string = req.body.emailAddress as string;
    registerPlayer(req, res, username, password, passwordConfirm, displayName, emailAddress);
});

app.post('/login', function (req: Request, res: Response) {
    let username: string = req.body.username as string;
    let password: string = req.body.password as string;
    logonPlayer(req, res, username, password);
});

if (DEBUG) {
    app.get('/register', function (req: Request, res: Response) {
        let username: string = req.query.username as string;
        let password: string = req.query.password as string;
        let passwordConfirm: string = req.query.passwordConfirm as string;
        let displayName: string = req.query.displayName as string;
        let emailAddress: string = req.query.emailAddress as string;
        registerPlayer(req, res, username, password, passwordConfirm, displayName, emailAddress);
    });

    app.get('/login', function (req: Request, res: Response) {
        let username: string = req.query.username as string;
        let password: string = req.query.password as string;
        logonPlayer(req, res, username, password);
    });
}

app.get('/logout', function (req: Request, res: Response) {
    console.log('logout', req);
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    if (player) {
        let dao: PlayerDao = new PlayerDao();
        dao.logoutPlayer(player, (updatedPlayer: Player, result: boolean) => {
            player = updatedPlayer;
            if (result) {
                sse.send({ status: 'OK', player: undefined, game: undefined });
                res.send({ status: 'OK', player: undefined, game: undefined });
            } else {
                player.message = 'Logout failed!';
                sse.send({ status: 'FAILED', player: player, game: undefined });
                res.send({ status: 'FAILED', player: player, game: undefined });
            }
        });
        // TODO:  Need to make sure the user is removed for any ongoing games.
    }
    // Whether or not we found the player go ahead and destroy the session.
    req.session.destroy(function () {
        console.log('user logged out.')
        sse.send({ status: 'OK', player: undefined, game: undefined });
        res.send({ status: 'OK', player: undefined, game: undefined });
    });
});

app.get('/check-username-availability', function (req: Request, res: Response) {
    let username: string = req.query.username as string;
    let dao: PlayerDao = new PlayerDao();
    dao.getPlayerByUserName(username, (player: Player) => {
        let available: boolean = true;
        if (-1 < player.id) {
            available = false;
        }
        res.send({ status: 'OK', available: available });
    });
});

app.get('/create', function (req: Request, res: Response) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let numberOfPlayers: string = req.query.players as string;
    GameServer.setupGame(parseInt(numberOfPlayers), (newGame: Game, result: boolean) => {
        console.log('newGame', newGame);
        if (newGame) {
            newGame.addPlayer(player, 0);
            sse.send({ status: 'OK', player: player, game: newGame });
            res.send({ status: 'OK', player: player, game: newGame });
        } else {
            sse.send({ status: 'FAILED', player: player, game: undefined });
            res.send({ status: 'FAILED', player: player, game: undefined });
        }

    });
});

app.post('/create', function (req: Request, res: Response) {
    let username: string = req.body.username as string;
    let player = checkSignIn(username);
    let numberOfPlayers: string = req.body.players as string;
    GameServer.setupGame(parseInt(numberOfPlayers), (newGame: Game, result: boolean) => {
        console.log('newGame', newGame);
        if (newGame) {
            newGame.addPlayer(player, 0);
            sse.send({ status: 'OK', player: player, game: newGame });
            res.send({ status: 'OK', player: player, game: newGame });
        } else {
            sse.send({ status: 'FAILED', player: player, game: undefined });
            res.send({ status: 'FAILED', player: player, game: undefined });
        }
    });
});

app.post('/join', function (req: Request, res: Response) {
    console.log('join', req);
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let gameCode: string = req.query.code as string;
    let games: Game[] = GameServer.Games.filter(item => item.code === gameCode);
    let game: Game;
    if (games && 1 === games.length) {
        game = games[0];
    } else {
        res.send({ status: 'FAILED', message: 'Game not found', player: player, game: undefined });
        game = new Game(4);
    }
    let status = 'OK'
    if (game.numPlayers < game.maxNumPlayers) {
        game.addPlayer(player, game.numPlayers);
    } else {
        player.message = 'Game is full!';
        status = 'ERROR'
    }
    sse.send({ status: status, player: player, game: game });
    res.send({ status: status, player: player, game: game });
    console.log('join GameState', game);
});

app.get('/start', function (req: Request, res: Response) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let gameCode: string = req.query.code as string;
    let games: Game[] = GameServer.Games.filter(item => item.code === gameCode);
    if (games && 1 === games.length) {
        let game: Game = games[0];
        game.start();
        sse.send({ status: 'OK', player: player, game: game });
        res.send({ status: 'OK', player: player, game: game });
    } else {
        sse.send({ status: 'FAILED', player: player, game: undefined });
        res.send({ status: 'FAILED', player: player, game: undefined });
    }
});

app.get('/play-card', function (req: Request, res: Response) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let gameCode: string = req.query.code as string;
    let games: Game[] = GameServer.Games.filter(item => item.code === gameCode);
    if (games && 1 === games.length) {
        let game: Game = games[0];
        let cardIndex: number = parseInt(req.query.cardIndex as string);	// Needs to be CARDS.DEATH_CARD or CARDS.LIFE_CARD
        if (game.playCard(player, cardIndex)) {
            sse.send({ status: 'OK', player: player, game: game });
            res.send({ status: 'OK', player: player, game: game });
        } else {
            sse.send({ status: 'FAILED', player: player, game: game });
            res.send({ status: 'FAILED', player: player, game: game });
        }
    }
});


app.get('/bid', function (req: Request, res: Response) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let gameCode: string = req.query.code as string;
    let games: Game[] = GameServer.Games.filter(item => item.code === gameCode);
    if (games && 1 === games.length) {
        let game: Game = games[0];
        let bid: number = parseInt(req.query.value as string);
        if (game.bid(player, bid)) {
            sse.send({ status: 'OK', player: player, game: game });
            res.send({ status: 'OK', player: player, game: game });
        } else {
            sse.send({ status: 'FAILED', player: player, game: game });
            res.send({ status: 'FAILED', player: player, game: game });
        }
    }
});

app.get('/reveal-card', function (req, res) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let gameCode: string = req.query.code as string;
    let chairIndex = parseInt(req.query.chairIndex as string);
    let cardIndex = parseInt(req.query.cardIndex as string);
    let games: Game[] = GameServer.Games.filter(item => item.code === gameCode);
    if (games && 1 === games.length) {
        let game: Game = games[0];
        if (game.revealCard(player, chairIndex, cardIndex)) {
            setTimeout(function () {
                sse.send(game);
            }, 5000);
            sse.send({ status: 'OK', player: player, game: game });
            res.send({ status: 'OK', player: player, game: game });
        } else {
            sse.send({ status: 'FAILED', player: player, game: game });
            res.send({ status: 'FAILED', player: player, game: game });
        }
    } else {
        sse.send({ status: 'FAILED', player: player, game: undefined });
        res.send({ status: 'FAILED', player: player, game: undefined });
    }
});

app.get('/pass', function (req, res) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let gameCode: string = req.query.code as string;
    let games: Game[] = GameServer.Games.filter(item => item.code === gameCode);
    if (games && 1 === games.length) {
        let game: Game = games[0];
        if (game.pass(player)) {
            sse.send({ status: 'OK', player: player, game: game });
            res.send({ status: 'OK', player: player, game: game });
        } else {
            sse.send({ status: 'FAILED', player: player, game: game });
            res.send({ status: 'FAILED', player: player, game: game });
        }
    }
});

app.get('/game-events', sse.init);

app.get('/end', function (req: Request, res: Response) {
    let username: string = req.query.username as string;
    let player = checkSignIn(username);
    let gameCode: string = req.query.code as string;
    let games: Game[] = GameServer.Games.filter(item => item.code === gameCode);
    if (games && 1 === games.length) {
        let game: Game = games[0];
        console.log('GameSever.Games before', GameServer.Games);
        GameServer.endGame(game, (updatedGame: Game, result: boolean) => {
            if (result) {
                console.log('GameSever.Games after', GameServer.Games);
                sse.send({ status: 'OK', player: player, game: undefined });
                res.send({ status: 'OK', player: player, game: undefined });
            } else {
                player.message = 'Failed to end game!';
                sse.send({ status: 'FAILED', player: player, game: undefined });
                res.send({ status: 'FAILED', player: player, game: undefined });
            }
        });
    } else {
        player.message = 'Game not found!';
        sse.send({ status: 'FAILED', player: player, game: undefined });
        res.send({ status: 'FAILED', player: player, game: undefined });
    }
});


app.listen(PORT);
console.log(`Listening on port ${PORT}...`);