import React from 'react';
import './App.css';
import Login from './components/Login';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import PrivateRoute from './components/PrivateRoute';

import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link
} from "react-router-dom";

function App() {
  return (
      <Router>
          <div>
              <nav>
                  <ul>
                      <li>
                          <Link to="/">Login</Link>
                      </li>
                      <li>
                          <Link to="/home">Home</Link>
                      </li>
                      <li>
                          <Link to="/lobby">Lobby</Link>
                      </li>
                      <li>
                          <Link to="/game">Game</Link>
                      </li>
                  </ul>
              </nav>
              
              <Switch>
                  <PrivateRoute path="/home">
                      <Home />
                  </PrivateRoute>
                  <PrivateRoute path="/lobby">
                      <Lobby />
                  </PrivateRoute>
                  <PrivateRoute path="/game">
                      <Game />
                  </PrivateRoute>
                  <Route path="/">
                      <Login />
                  </Route>
              </Switch>
          </div>
      </Router>
  );
}

export default App;
