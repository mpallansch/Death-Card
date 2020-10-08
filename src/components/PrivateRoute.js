import React, { useContext} from 'react';
import { Route, Redirect } from "react-router-dom";
import Context from '../context';

export default ({ children, ...rest }) => {

    const { userContext } = useContext( Context );

    return (
        <Route
            {...rest}
            render={({ location }) =>
                userContext && userContext.isAuthenticated ? (
                    children
                ) : (
                        <Redirect
                            to={{
                                pathname: "/login",
                                state: { from: location }
                            }}
                        />
                    )
            }
        />
    );
}