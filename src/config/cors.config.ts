export const corsConfig = {
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
    staging: {
        origin: [
            process.env.STAGING_BACKEND_URL || 'https://staging-api.unifoodapp.com',
            process.env.STAGING_WEB_URL || 'https://staging.unifoodapp.com',
            /^exp:\/\/.*$/,
            /^unifoodapp:\/\/.*$/,
        ],
        credentials: true,
    },
    production: {
        origin: [
            process.env.PRODUCTION_BACKEND_URL || 'https://api.unifoodapp.com',
            process.env.PRODUCTION_WEB_URL || 'https://unifoodapp.com',
            'unifoodapp://',
            'exp://expo.io/@unifoodapp/unifoodapp',
            /^unifoodapp:\/\/.*$/,
        ],
        credentials: true,
    },
};

export function getCorsConfig(){
    const env = process.env.NODE_ENV || 'development';
    return corsConfig[env];
}