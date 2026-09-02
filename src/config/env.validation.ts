import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Database
  DATABASE_URL: Joi.string().uri().required(),

  // JWT
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRATION: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

  // JWT Expiry (new)
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  GOOGLE_CALLBACK_URL: Joi.string().optional(),

  // App
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  NEXT_PUBLIC_API_URL: Joi.string()
    .uri()
    .allow('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('http://localhost:3001/api'),
    }),

  // Trial & billing
  TRIAL_DURATION_DAYS: Joi.number().default(14),
  ALLOW_TRIAL_WITHOUT_CARD: Joi.boolean().default(false),
  TRIAL_SMS_LIMIT: Joi.number().default(100),
  TRIAL_AI_LIMIT: Joi.number().default(5),
  TRIAL_DAILY_AI_LIMIT: Joi.number().default(2),
  HOURLY_SMS_RATE_LIMIT: Joi.number().default(20),
  AI_MONTHLY_LIMIT: Joi.number().default(50),

  // Redis
  REDIS_HOST: Joi.string().required().default('localhost'), // Dev default — override in production via env var
  REDIS_PORT: Joi.number().required().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // Termii (primary for African numbers, Twilio stays the fallback)
  TERMII_API_KEY: Joi.string().optional().allow('').default(''),
  TERMII_SENDER_ID: Joi.string().optional().allow('').default('Meetora'),
  TERMII_BASE_URL: Joi.string()
    .optional()
    .allow('')
    .default('https://v3.api.termii.com'),
  // Empty disables the inbound-webhook secret check.
  TERMII_WEBHOOK_SECRET: Joi.string().optional().allow('').default(''),

  // Twilio
  TWILIO_ACCOUNT_SID: Joi.string().required().allow('').default(''),
  TWILIO_AUTH_TOKEN: Joi.string().required().allow('').default(''),
  TWILIO_PHONE_NUMBER: Joi.string().required().allow('').default(''),
  TWILIO_WEBHOOK_URL: Joi.string()
    .allow('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('http://localhost:3000/api/webhooks/twilio'),
    }),

  // Paystack
  PAYSTACK_SECRET_KEY: Joi.string().required().allow('').default(''),
  PAYSTACK_PUBLIC_KEY: Joi.string().allow('').default(''),
  PAYSTACK_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  PAYSTACK_SMS_PLAN_CODE: Joi.string().allow('').default(''),
  PAYSTACK_SMS_VOICE_PLAN_CODE: Joi.string().allow('').default(''),
  PAYSTACK_SMS_VOICE_AI_PLAN_CODE: Joi.string().allow('').default(''),

  // OpenAI
  OPENAI_API_KEY: Joi.string().required().allow('').default(''),
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),

  // Google Business Reviews OAuth
  GOOGLE_REVIEWS_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_REVIEWS_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_REVIEWS_REDIRECT_URI: Joi.string()
    .allow('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('http://localhost:3001/api/google-reviews/oauth/callback'),
    }),

  // Frontend URL (used for OAuth redirects)
  FRONTEND_URL: Joi.string()
    .allow('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('http://localhost:3000'),
    }),

  // Twilio WhatsApp
  TWILIO_WHATSAPP_NUMBER: Joi.string().allow('').default(''),

  // Google Calendar OAuth
  GOOGLE_CALENDAR_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CALENDAR_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_CALENDAR_REDIRECT_URI: Joi.string()
    .allow('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('http://localhost:3001/api/calendar/google/callback'),
    }),

  // Microsoft Outlook OAuth
  OUTLOOK_CLIENT_ID: Joi.string().allow('').default(''),
  OUTLOOK_CLIENT_SECRET: Joi.string().allow('').default(''),
  OUTLOOK_REDIRECT_URI: Joi.string()
    .allow('')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('http://localhost:3001/api/calendar/outlook/callback'),
    }),
  OUTLOOK_TENANT_ID: Joi.string().allow('').default('common'),
  UNREAD_WINDOW_MINUTES: Joi.number().default(30),
  API_BASE_URL: Joi.string().uri().required(),

  // Email (SMTP)
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().integer().optional().default(465),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMTP_FROM: Joi.string().optional().default('Meetora <onboarding@resend.dev>'),

  // Campaign queue rate limiting
  CAMPAIGN_RATE_LIMIT_MAX: Joi.number().integer().optional().default(50),
  CAMPAIGN_RATE_LIMIT_DURATION: Joi.number().integer().optional().default(1000),
  CAMPAIGN_JOB_ATTEMPTS: Joi.number().integer().optional().default(3),
  CAMPAIGN_BACKOFF_DELAY: Joi.number().integer().optional().default(2000),
});
