import Redis from 'ioredis';

// Initialize Redis client with connection details
const redis = new Redis({
  host: process.env.REDIS_URL,
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// LUA script to increment the counter
const unconditionalIncrementScript = `
  local counter = redis.call('GET', KEYS[1])
  if not counter then
    counter = 0
  end
  counter = counter + 1
  redis.call('SET', KEYS[1], counter)
  return counter
`;

// LUA script to increment the counter only if it is less than the given value
const conditionalIncrementScript = `
  local counter = redis.call('GET', KEYS[1])
  local maxValue = tonumber(ARGV[1])
  
  if not counter then
    counter = 0
  end
  
  if counter < maxValue then
    redis.call('INCR', KEYS[1])
    counter = redis.call('GET', KEYS[1])
  end

  return counter
`;

export const handler = async (event: any = {}): Promise<any> => {
  
  try {
    const id = event.pathParameters.id;
    console.log('incrementing counter for id:', id);

    const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
    const maxCounterValue = process.env.MAX_COUNTER_VALUE || '10';
    
    console.log('using conditional writes:', useConditionalWrites);
    console.log('max counter value:', maxCounterValue);

    let result;
    if(useConditionalWrites) {
      result = await redis.eval(conditionalIncrementScript, 1, id, maxCounterValue);
    }else{
      result = await redis.eval(unconditionalIncrementScript, 1, id);
    }
    
    const resultJson = JSON.stringify({ counter: result });

    console.log(resultJson);
    
    return {
      statusCode: 200,
      body: resultJson,
    };
  } catch (error) {
    let errorMsg = JSON.stringify({ error: (error as Error).message })
    console.error(errorMsg);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};