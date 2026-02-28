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

    // Trial & billing
    TRIAL_DURATION_DAYS: Joi.number().default(14),
    ALLOW_TRIAL_WITHOUT_CARD: Joi.boolean().default(false),
    TRIAL_SMS_LIMIT: Joi.number().default(100),
    TRIAL_AI_LIMIT: Joi.number().default(5),
    TRIAL_DAILY_AI_LIMIT: Joi.number().default(2),
    HOURLY_SMS_RATE_LIMIT: Joi.number().default(20),
    AI_MONTHLY_LIMIT: Joi.number().default(50),

    // Redis
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().allow('').default(''),

    // Twilio
    TWILIO_ACCOUNT_SID: Joi.string().allow('').default(''),
    TWILIO_AUTH_TOKEN: Joi.string().allow('').default(''),
    TWILIO_PHONE_NUMBER: Joi.string().allow('').default(''),
    TWILIO_WEBHOOK_URL: Joi.string().allow('').default('http://localhost:3000/api/webhooks/twilio'),

    // Paystack
    PAYSTACK_SECRET_KEY: Joi.string().allow('').default(''),
    PAYSTACK_PUBLIC_KEY: Joi.string().allow('').default(''),
    PAYSTACK_WEBHOOK_SECRET: Joi.string().allow('').default(''),
    PAYSTACK_SMS_PLAN_CODE: Joi.string().allow('').default(''),
    PAYSTACK_SMS_VOICE_PLAN_CODE: Joi.string().allow('').default(''),
    PAYSTACK_SMS_VOICE_AI_PLAN_CODE: Joi.string().allow('').default(''),
});
