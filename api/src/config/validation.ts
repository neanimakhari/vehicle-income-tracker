import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_PASSWORD_FILE: Joi.string().allow('').optional(),
  DB_DATABASE: Joi.string().required(),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_DEFAULT_SCHEMA: Joi.string().default('platform'),
  JWT_SECRET: Joi.string()
    .min(16)
    .when('JWT_SECRET_FILE', {
      is: Joi.string().min(1),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
  JWT_SECRET_FILE: Joi.string().allow('').optional(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(16)
    .when('JWT_REFRESH_SECRET_FILE', {
      is: Joi.string().min(1),
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
  JWT_REFRESH_SECRET_FILE: Joi.string().allow('').optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  FORCE_MFA_FOR_ADMINS: Joi.boolean().truthy('true').falsy('false').default(false),
  MAX_LOGIN_ATTEMPTS: Joi.number().min(1).default(5),
  LOCKOUT_MINUTES: Joi.number().min(1).default(15),
  BOOTSTRAP_TOKEN: Joi.string()
    .allow('')
    .when('BOOTSTRAP_TOKEN_FILE', {
      is: Joi.string().min(1),
      then: Joi.optional(),
      otherwise: Joi.string().allow('').default(''),
    }),
  BOOTSTRAP_TOKEN_FILE: Joi.string().allow('').optional(),
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_LIMIT: Joi.number().default(100),
});

