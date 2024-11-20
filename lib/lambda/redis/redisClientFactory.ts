import Redis from 'ioredis';

export const buildRedisClient = async () : Promise<Redis> =>{
	return new Redis({
    host: process.env.REDIS_URL,
    port: parseInt(process.env.REDIS_PORT || '6379')}
  );
}
