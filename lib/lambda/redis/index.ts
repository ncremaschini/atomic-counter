import { buildRedisClient } from "./redisClientFactory";

export const handler = async (event: any = {}): Promise<any> => {

  const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
  const maxCounterValue = process.env.MAX_COUNTER_VALUE || '10';
  let returnObj = {};

  try {
    const id = event.pathParameters.id;

    const redisClient = await buildRedisClient();
    
    const result = await redisClient.eval(getLuaScript(useConditionalWrites), 1, id, maxCounterValue);

    if ((result as string).includes('Counter has reached its maximum value of: ')) {

      returnObj = {
        statusCode: 409,
        body: JSON.stringify({
          error: result,
          useConditionalWrites: useConditionalWrites
        })
      };
    } else {

      const resultJson = JSON.stringify({ counter:  Number(result), useConditionalWrites: useConditionalWrites });
      console.log(resultJson);

      returnObj = {
        statusCode: 200,
        body: resultJson
      }
    }

  } catch (error) {
    let errorMsg = JSON.stringify({ error: (error as Error).message });
    console.error(errorMsg);

    returnObj = {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    }
  }

  return returnObj;
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