import { CacheClient, CacheGetResponse, CacheIncrementResponse, CacheSetIfAbsentResponse, CacheSetIfPresentAndNotEqualResponse } from '@gomomento/sdk';

import { buildMomentoClient } from "./momentoClientFactory";

const CONDITIONAL_CHECK_FAILED_EXCEPTION = "ConditionalCheckFailedException";
const CONFLICT_EXCEPTION = "ConflictException";

export const handler = async (event: any = {}): Promise<any> => {

  const cacheName = process.env.MOMENTO_CACHE_NAME || 'cache';
  const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
  const maxCounterValue = process.env.MAX_COUNTER_VALUE || '10';

  try {

    const id = event.pathParameters?.id;
    const momentoCacheClient = await buildMomentoClient();

    let counter = 0;

    if (useConditionalWrites) {
      counter = await handleConditionalWrites(momentoCacheClient,cacheName, id, maxCounterValue);
    } else {
      counter = await handleUnconditionalWrites(momentoCacheClient,cacheName, id);
    }

    const resultJson = JSON.stringify({ counter:  counter, useConditionalWrites: useConditionalWrites });
    console.log(resultJson);

    return {
      statusCode: 200,
      body: resultJson
    };

  } catch (dbError: any) {

    console.error(dbError.message);

    let returnObj = {};

    switch (dbError.message) {
      case CONDITIONAL_CHECK_FAILED_EXCEPTION:
        returnObj = {
          statusCode: 409,
          body: JSON.stringify({
            error: "Counter has reached its maximum value of: " + maxCounterValue,
            useConditionalWrites: useConditionalWrites
          })
        };
        break
      case CONFLICT_EXCEPTION:
        returnObj = {
          statusCode: 409,
          body: JSON.stringify({
            error: "Race conditions! Please try again",
            useConditionalWrites: useConditionalWrites
          })
        };
        break;
      default:
        returnObj = {
          statusCode: 500,
          body: JSON.stringify({ error: "Internal server error" })
        };
        break;
    }

    return returnObj
  }
};

async function handleConditionalWrites(momentoClient: CacheClient, cacheName: string, id: string, maxCounterValue: string){

  let counter = 0;

  const cacheGetResponse = await momentoClient.get(cacheName, id);

  switch (cacheGetResponse.type) {
    case CacheGetResponse.Hit:
      const currentCounter = Number(cacheGetResponse.value());
      const nextCounter =  currentCounter + 1;
      const strNextCounter = nextCounter.toString();

      counter = await handleSetIfPresentAndNotEqual(momentoClient,cacheName, id, strNextCounter, maxCounterValue);
      break;  
    case CacheGetResponse.Miss:
      counter = await hanldeSetIfAbsent(momentoClient, cacheName, id, '1');
      break;
    case CacheGetResponse.Error:
      throw new Error(cacheGetResponse.toString()); 
  }

  return counter
}

async function handleUnconditionalWrites(momentoClient: CacheClient,cacheName: string, id: string) {
  let counter = 0;

  const cacheIncrementResponse = await momentoClient.increment(cacheName, id, 1);
  switch (cacheIncrementResponse.type) {
    case CacheIncrementResponse.Success:
      counter = cacheIncrementResponse.value();
      break;
    case CacheIncrementResponse.Error:
      throw new Error(cacheIncrementResponse.message());
  }

  return counter
}

async function handleSetIfPresentAndNotEqual(momentoClient: CacheClient,cacheName: string, id: string, nextCounter: string, maxCounterValue: string) {
  
  const cacheSetIfPresentAndNotEqualResponse = await momentoClient.setIfPresentAndNotEqual(cacheName, id, nextCounter, maxCounterValue);
  let counter: number;
  switch (cacheSetIfPresentAndNotEqualResponse.type) {
    case CacheSetIfPresentAndNotEqualResponse.Stored:
      counter = Number(nextCounter);
      break;
    case CacheSetIfPresentAndNotEqualResponse.NotStored:
      throw new Error(CONDITIONAL_CHECK_FAILED_EXCEPTION);
    case CacheSetIfPresentAndNotEqualResponse.Error:
      throw new Error(cacheSetIfPresentAndNotEqualResponse.message());
  }
  return counter;
}

async function hanldeSetIfAbsent(momentoClient: CacheClient,cacheName: string, id: string, value: string) {
  let counter = 0;
  const setIfAbsentResponse = await momentoClient.setIfAbsent(cacheName, id, value);
  switch (setIfAbsentResponse.type) {
    case CacheSetIfAbsentResponse.Stored:
      counter = 1;
      break
    case CacheSetIfAbsentResponse.NotStored:
      throw new Error(CONFLICT_EXCEPTION);
    case CacheSetIfAbsentResponse.Error:
      throw new Error(setIfAbsentResponse.message());
    default:
      break;
  }

  return counter;
}

