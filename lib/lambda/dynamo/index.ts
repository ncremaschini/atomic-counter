import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({});

export const handler = async (event: any = {}): Promise<any> => {
  const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
  const maxCounterValue = process.env.MAX_COUNTER_VALUE || '10';
  
  try {
    const id = event.pathParameters?.id;
    
    const writeParams = getWriteParams(useConditionalWrites, id, maxCounterValue);

    const result = await dynamodb.send(new UpdateItemCommand(writeParams));
    
    const counter = Number(result.Attributes?.atomic_counter.N);
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ counter:  counter })
    };
    
  } catch (dbError : any) {
    
    let errorMsg = JSON.stringify(dbError)
    console.error(errorMsg);

    let returnObj = {}

    if(dbError.name === 'ConditionalCheckFailedException' ){
      returnObj = {
        statusCode: 409,
        body: JSON.stringify({ error: "Counter has reached its maximum value of: " + maxCounterValue }) 
      };
    }else{
      returnObj = {
        statusCode: 500,
        body: JSON.stringify({ error: "Internal server error" })
      };
    }

    return returnObj
  }
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
