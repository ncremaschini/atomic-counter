import Redis from 'ioredis';

// Initialize Redis client with connection details
const redis = new Redis({
  host: process.env.REDIS_URL,
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
const maxCounterValue = process.env.MAX_COUNTER_VALUE || '10';

export const handler = async (event: any = {}): Promise<any> => {
  
  try {
    const id = event.pathParameters.id;
    
    const result = await redis.eval(getLuaScript(useConditionalWrites), 1, id, maxCounterValue);
    
    console.log(result);

    if ((result as string).includes('Counter has reached its maximum value of: ')) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: result })
      };
    } else {
      return {
        statusCode: 200,
        body: JSON.stringify({ counter: Number(result) })
      };
    }

  } catch (error) {
    let errorMsg = JSON.stringify({ error: (error as Error).message })
    console.error(errorMsg);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};

const getLuaScript = (useConditionalWrites: boolean) => {

  const unconditionalIncrementScript = `
    redis.call('INCR', KEYS[1])
    local counter = redis.call('GET', KEYS[1])
    return counter
  `;

  const conditionalIncrementScript = `
 
    local counter = redis.call('GET', KEYS[1])
    local maxValue = tonumber(ARGV[1])
    
    if not counter then
      counter = 0
    end
    
    counter = tonumber(counter)

    if counter < maxValue then
      redis.call('INCR', KEYS[1])
      counter = redis.call('GET', KEYS[1])
      return counter
    else
      return 'Counter has reached its maximum value of: ' .. maxValue
    end
  `;

  return useConditionalWrites ? conditionalIncrementScript : unconditionalIncrementScript;

}