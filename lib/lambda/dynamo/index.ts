// write a lambda handler to increment the counter in the dynamodb table
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME || '';


export const handler = async (event: any = {}): Promise<any> => {
 
  try {
    const id = event.pathParameters?.id;
    console.log('incrementing counter for id:', id);
    
    const params = {
      TableName: TABLE_NAME,
      Key: {
        id: { S: id },
      },
      UpdateExpression: 'ADD atomic_counter :inc',
      ExpressionAttributeValues: {
        ':inc': { N: '1' },
      },
      ReturnValues: 'UPDATED_NEW' as const,
    };

    const result = await dynamodb.send(new UpdateItemCommand(params));
    const counter = Number(result.Attributes?.atomic_counter.N);
    
    const resultJson = JSON.stringify({ counter:  counter });
    
    console.log(resultJson);
    return { statusCode: 200, body: resultJson };
    
  } catch (dbError) {
    return { statusCode: 500, body: JSON.stringify(dbError) };
  }
};