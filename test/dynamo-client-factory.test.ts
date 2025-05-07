import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { buildDynamoDbClient } from '../lib/lambda/dynamo/dynamoDbClientFactory';

jest.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: jest.fn().mockImplementation(() => {
      return {};
    })
  };
});

describe('DynamoDB Client Factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a DynamoDB client', async () => {
    const client = await buildDynamoDbClient();
    
    expect(client).toBeDefined();
    expect(DynamoDBClient).toHaveBeenCalledTimes(1);
    expect(DynamoDBClient).toHaveBeenCalledWith({});
  });
});
