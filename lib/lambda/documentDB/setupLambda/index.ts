import { buildDocumentDbClient } from "../clientFactory/documentDbClientFactory";

export const handler = async (event: any = {}): Promise<any> => {

  let returnObj = {};

  try {

    const documentDBClient = await buildDocumentDbClient();

    await documentDBClient.connect();

    const countersCollection = documentDBClient.db("atomic_counter").collection('counters');

    //since we are using upsert option we need to create an index on the counter_id field to avoid duplicate key errors. index is created only if it does not exist
    const indexCreationResult =  await countersCollection.createIndex({ counter_id: 1 },
      {
        unique: true,
        name: "counter_id_index"
      });

    returnObj = {
      statusCode: 200,
      body: indexCreationResult
    }

  } catch (dbError: any) {

    console.error(dbError.message);
    
    returnObj = {
      statusCode: 500,
      body: dbError.message
    }
  }

  return returnObj
};


