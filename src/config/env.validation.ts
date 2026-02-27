import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
    // Database
    DATABASE_URL: Joi.string().uri().required(),

    // JWT
    JWT_SECRET: Joi.string().min(16).required(),
    JWT_REFRESH_SECRET: Joi.string().min(16).required(),
    JWT_EXPIRATION: Joi.string().default('15m'),
    JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

    // App
    PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
});
