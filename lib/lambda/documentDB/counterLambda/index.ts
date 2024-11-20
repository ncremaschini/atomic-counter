import { buildDocumentDbClient } from "../clientFactory/documentDbClientFactory";

const CONDITIONAL_CHECK_FAILED_EXCEPTION = "E11000 duplicate key error collection";

export const handler = async (event: any = {}): Promise<any> => {

  const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
  const maxCounterValue = process.env.MAX_COUNTER_VALUE || '10';
  let returnObj = {};

  try {

    const id = event.pathParameters?.id;

    const documentDBClient = await buildDocumentDbClient();

    await documentDBClient.connect();

    const countersCollection = documentDBClient.db("atomic_counter").collection('counters');

    const updateFilter = getUpdateFilter(useConditionalWrites, id, maxCounterValue);

    const updateResult = await countersCollection.updateOne(
      updateFilter,
      {
        $inc: { atomic_counter: 1 }
      },
      {
        // Insert the document if it does not exist: since the filter is based on the counter_id and counter lt than maximum value, mongo would try to create a new document, but since an unique index is created on counter_id, it would fail with duplicate key error
        upsert: true, 
      }
    );

    console.log(updateResult);

    if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {

      const updatedItem = await countersCollection.findOne({ counter_id: id });
      if (!updatedItem) {
        throw new Error("Failed to retrieve the updated item.");
      }

      const counter = Number(updatedItem.atomic_counter);

      const resultJson = JSON.stringify({ counter: counter, useConditionalWrites: useConditionalWrites });
      console.log(resultJson);

      returnObj = {
        statusCode: 200,
        body: resultJson
      }
    } else {
      throw new Error("Failed to update the counter");
    }

  } catch (dbError: any) {
    console.error(dbError.name);
    console.error(dbError.message);

    if (dbError.message.startsWith(CONDITIONAL_CHECK_FAILED_EXCEPTION)) { // duplicate key error
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
const getUpdateFilter = (useConditionalWrites: boolean, id: number, maxCounterValue: string) => {
  const unconditionalWriteParams = {
    counter_id: id
  }

  const conditionalWriteParams = {
    counter_id: id,
    $and: [
      { atomic_counter: { $lt: Number(maxCounterValue) } }
    ],
  }

  return useConditionalWrites ? conditionalWriteParams : unconditionalWriteParams;
}


