import Redis from 'ioredis';

// Initialize Redis client with connection details
const redis = new Redis({
  host: process.env.REDIS_URL,
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// LUA script to increment the counter
const incrementScript = `
  local counter = redis.call('GET', KEYS[1])
  if not counter then
    counter = 0
  end
  counter = counter + 1
  redis.call('SET', KEYS[1], counter)
  return counter
`;

export const handler = async (event: any = {}): Promise<any> => {
  
  try {
    const id = event.pathParameters.id;
    console.log('incrementing counter for id:', id);
    
    const result = await redis.eval(incrementScript, 1, id);
    return {
      statusCode: 200,
      body: JSON.stringify({ counter: result }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};