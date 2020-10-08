import React, { useState } from 'react';

export default () => {

    const [state, setState] = useState({ formValues: {id: '', password: ''} });

    let formValues = state.formValues;

    function handleSubmit() {

    }

    function checkAvailability() {

    }

    function formValid() {
        if (state.formValues.id && state.formValues.id.length > 6 && state.formValues.password && state.formValues.password.length > 6) {
            return true;
        }
        return false;
    }

    function handleChange(event) {
        const target = event.target;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        const name = target.name;

        formValues[name] = value;

        setState({ formValues: formValues });
    }

    let availabilityButton = '', emailSection = '', registerSection = <p> Don't have an account? <button type="button" value="true" name="register" onClick={handleChange}>Register Now</button></p>;

    if (state.formValues.register === "true") {
        availabilityButton = <button type="button" onClick={checkAvailability()}>Check Availability</button>
        emailSection = <div className="row">
            <label htmlFor="email">Email Address: </label>
            <input id="email" type="email" name="email" value={formValues.email} onChange={handleChange}/>
        </div>
        registerSection = <p><button type="button" value="false" name="register" onClick={handleChange} > Login</button ></p >
    }

    let submitButton;

    if ( formValid() ) {
        submitButton = <input type="submit" value="Submit" />
    } else {
        submitButton = <input type="submit" value="Submit" disabled />
    }

    let loading = '';

    if (state.formValues.loading) {
        loading = <p> Loading....</p >
    }

    return (
        <div className="wrapper">
            <h1>Login Screen</h1>
            <form onSubmit={handleSubmit}>
                <div className="row">
                    <label htmlFor="username">Username: </label><input id="username" type="text" name="id" value={formValues.id} onChange={handleChange} />
                    {availabilityButton}
                    <span>TODO username availability</span>
                </div>
                <div className="row">
                    <label htmlFor="password">Password: </label>
                    <input id="password" type="password" name="password" value={formValues.password} onChange={handleChange} />
                </div>
                {emailSection}
                {submitButton}
                <p id="message">{formValues.message}</p>
                {registerSection}
                {loading}
            </form >
        </div >  
    )
}