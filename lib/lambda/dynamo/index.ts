import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { buildDynamoDbClient } from "./dynamoDbClientFactory";

export const handler = async (event: any = {}): Promise<any> => {

  const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
  const maxCounterValue = process.env.MAX_COUNTER_VALUE || '10';
  let returnObj = {};

  try {

    const id = event.pathParameters?.id;
  
    const writeParams = getWriteParams(useConditionalWrites, id, maxCounterValue);
    
    const dynamoDBClient = await buildDynamoDbClient();
    
    const result = await dynamoDBClient.send(new UpdateItemCommand(writeParams));

    const counter = Number(result.Attributes?.atomic_counter.N);

    const resultJson = JSON.stringify({ counter:  counter, useConditionalWrites: useConditionalWrites });
    console.log(resultJson);

    returnObj = {
      statusCode: 200,
      body: resultJson
    }
    
  } catch (dbError: any) {

    console.error(dbError.message);

    if (dbError.name === 'ConditionalCheckFailedException') {
      returnObj = {
        statusCode: 409,
        body: JSON.stringify({
          error: "Counter has reached its maximum value of: " + maxCounterValue,
          useConditionalWrites: useConditionalWrites
        })
      };
    } else {
      returnObj = {
        statusCode: 500,
        body: JSON.stringify({ error: "Internal server error" })
      };
    }
  }

  return returnObj
};

const getWriteParams = (useConditionalWrites: boolean, id: string, maxCounterValue: string) => {
  const TABLE_NAME = process.env.TABLE_NAME || '';

  const unconditionalWriteParams = {
    TableName: TABLE_NAME,
    Key: {
      id: { S: id },
    },
    UpdateExpression: 'ADD atomic_counter :inc',
    ExpressionAttributeValues: {
      ':inc': { N: '1' }
    },
    ReturnValues: 'UPDATED_NEW' as const,
  };

  const conditionalWriteParams = {
    TableName: TABLE_NAME,
    Key: {
      id: { S: id },
    },
    UpdateExpression: 'ADD atomic_counter :inc',
    ConditionExpression: 'attribute_not_exists(atomic_counter) or atomic_counter < :max',
    ExpressionAttributeValues: {
      ':inc': { N: '1' },
      ':max': { N: maxCounterValue },
    },
    ReturnValues: 'UPDATED_NEW' as const,
  };

  return useConditionalWrites ? conditionalWriteParams : unconditionalWriteParams;
}
