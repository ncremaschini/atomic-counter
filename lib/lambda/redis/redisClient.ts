import Redis from 'ioredis';

// Initialize Redis client with connection details
export const redisClient = new Redis({
  host: process.env.REDIS_URL,
  port: parseInt(process.env.REDIS_PORT || '6379'),
});