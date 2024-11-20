import * as fs from 'fs';

import { Connection } from "mysql2/promise";
import { createDbConnection } from "../clientFactory/tiDbClientFactory";

const DB = process.env.TIDB_DATABASE || 'test';

export const handler = async (event: any = {}): Promise<any> => {
  
  let returnObj = {};
  let connection: Connection | null = null;

  try {
    //tell to connection factory to not connect to any specific database, since we are going to create one
    connection = await createDbConnection(null);

    await connection.execute('CREATE DATABASE IF NOT EXISTS ' + DB);

    await connection.execute('CREATE TABLE IF NOT EXISTS '+ DB + '.counters (counter_id INT NOT NULL, counter_value INT NOT NULL DEFAULT 0, PRIMARY KEY (counter_id));');

    await connection.execute('SET GLOBAL tidb_multi_statement_mode=\'ON\'');
    
    returnObj = {
      statusCode: 200,
      body: "Setup successful completed"
    }

    console.log("Setup successful completed");

  } catch (dbError: any) {

    console.error(dbError.message);
    
    returnObj = {
      statusCode: 500,
      body: dbError.message
    }
  }finally{
    if (connection) {
      await connection.end();
    }
  }

  return returnObj
};


