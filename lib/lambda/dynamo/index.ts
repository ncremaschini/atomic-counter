// write a lambda handler to increment the counter in the dynamodb table
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

import { Condition } from "aws-cdk-lib/aws-stepfunctions";

const dynamodb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || '';


export const handler = async (event: any = {}): Promise<any> => {
  const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
  const maxCounterValue = process.env.MAX_COUNTER_VALUE || '10';
  
  try {
    const id = event.pathParameters?.id;
    console.log('incrementing counter for id:', id);
    
    
    
    console.log('using conditional writes:', useConditionalWrites);
    console.log('max counter value:', maxCounterValue);

    let unconditionalWriteParams = {
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

    let conditionalWriteParams = {
      TableName: TABLE_NAME,
      Key: {
        id: { S: id },
      },
      UpdateExpression: 'ADD atomic_counter :inc',
      ConditionExpression: 'atomic_counter < :max',
      ExpressionAttributeValues: {
        ':inc': { N: '1' },
      },
      ConditionExpressionAttributeValues: {
        ':max': { N: maxCounterValue },
      },
      ReturnValues: 'UPDATED_NEW' as const,
    };

    const result = await dynamodb.send(new UpdateItemCommand(useConditionalWrites ? conditionalWriteParams : unconditionalWriteParams));
    const counter = Number(result.Attributes?.atomic_counter.N);
    
    const resultJson = JSON.stringify({ counter:  counter });
    
    console.log(resultJson);
    return { 
      statusCode: 200, 
      body: JSON.stringify(resultJson) 
    };
    
  } catch (dbError : any) {

    if(dbError.name === 'ConditionalCheckFailedException' ){
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "Counter has reached its maximum value of: ", maxCounterValue }) 
      };
    }

    let errorMsg = JSON.stringify(dbError)
    console.error(errorMsg);

    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};