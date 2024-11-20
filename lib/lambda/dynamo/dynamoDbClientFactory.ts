import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const buildDynamoDbClient = async () : Promise<DynamoDBClient> =>{
	return new DynamoDBClient({});
}

