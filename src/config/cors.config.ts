export const corsConfig ={
    development: {
        origin: [
            'http://localhost:19006',
            'http://localhost:3000',
            'http://192.168.1.100:19006',
            /^exp:\/\/.*$/,
            /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
        ],
        credentials: true,
    },
    production: {
        origin: '*',
        credentials: false,
    },
    staging: {
        origin: '*',
        credentials: false,
    },
};

export function getCorsConfig(){
    const env = process.env.NODE_ENV || 'development';
    return corsConfig[env];
}