const prod = {
    apiRoot: ''
};

const dev = {
    apiRoot: 'http://localhost:3001/'
 };

export const config = process.env.NODE_ENV === ‘development’ ? dev: prod;