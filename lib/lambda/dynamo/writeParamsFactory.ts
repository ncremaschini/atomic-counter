export class writeParamsFactory {
    static getWriteParams(useConditionalWrites: boolean, id: string, maxCounterValue: string) {
      const TABLE_NAME = 'YourTableName'; // Replace with your actual table name
  
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
        ConditionExpression: 'atomic_counter < :max',
        ExpressionAttributeValues: {
          ':inc': { N: '1' },
          ':max': { N: maxCounterValue },
        },
        ReturnValues: 'UPDATED_NEW' as const,
      };
  
      return useConditionalWrites ? conditionalWriteParams : unconditionalWriteParams;
    }
  }