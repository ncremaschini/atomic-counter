import { Connection } from "mysql2/promise";
import { RowDataPacket } from 'mysql2';
import { createDbConnection } from "../clientFactory/tiDbClientFactory";

const CONDITIONAL_CHECK_FAILED_EXCEPTION = "No rows updated, max counter value reached";

export const handler = async (event: any = {}): Promise<any> => {

  const DB = process.env.TIDB_DATABASE || 'test';
  const useConditionalWrites = process.env.USE_CONDITIONAL_WRITES === 'true' ? true : false;
  const maxCounterValue = Number(process.env.MAX_COUNTER_VALUE || '10');

  let connection: Connection | null = null;
  let returnObj = {};

  try {

    const id = event.pathParameters?.id;

    //tell to connection factory to  connect to specific databass
    connection = await createDbConnection(DB);

    const updateFilter = getUpdateFilter(useConditionalWrites);

    const params = {
      id: id,
      max_value: maxCounterValue
    }

    const [rows] = await connection.query<RowDataPacket[]>(updateFilter, params);

    const upsertResult = rows[1] as RowDataPacket;
    const postUpsertSelect = rows[2] as RowDataPacket;

    /** 
      Since we are using an insert on duplicate key update, when the record is inserted the affectedRows is 1, when it is updated the affectedRows is 2 (one by the insert and one by the update).
      This means that if the affectedRows is 1 and the counter value is equal to the maxCounterValue,  it has not been updated because it reached the maximum value.
    */
    if (upsertResult.affectedRows === 1 && postUpsertSelect[0].counter_value === maxCounterValue) {
      throw new Error(CONDITIONAL_CHECK_FAILED_EXCEPTION);
    }

    returnObj = {
      statusCode: 200,
      body: JSON.stringify({ counter: postUpsertSelect[0].counter_value, useConditionalWrites: useConditionalWrites })
    }

  } catch (dbError: any) {
    console.error(dbError.name);
    console.error(dbError.message);

    if (dbError.message.startsWith(CONDITIONAL_CHECK_FAILED_EXCEPTION)) {
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
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  return returnObj
};

const getUpdateFilter = (useConditionalWrites: boolean): string => {

  const unconditionalWriteParams = 'SELECT counter_value FROM counters WHERE counter_id = :id FOR UPDATE;  \
                                    INSERT INTO counters (counter_id, counter_value) VALUES (:id, 1) \
                                    ON DUPLICATE KEY UPDATE counter_value = counter_value + 1; \
                                    SELECT counter_value FROM counters WHERE counter_id = :id; \
                                    COMMIT;';

  const conditionalWriteParams = 'SELECT counter_value FROM counters WHERE counter_id = :id FOR UPDATE;  \
                                  INSERT INTO counters (counter_id, counter_value) VALUES (:id, 1) \
                                  ON DUPLICATE KEY UPDATE counter_value = IF(counter_value < :max_value, counter_value + 1, counter_value);\
                                  SELECT counter_value FROM counters WHERE counter_id = :id; \
                                  COMMIT;';

  return useConditionalWrites ? conditionalWriteParams : unconditionalWriteParams;
}


