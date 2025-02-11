import { Connection } from "mysql2/promise";
import { createConnection } from "mysql2/promise";

export const createDbConnection = async (db: any) : Promise<Connection> =>{
	
	const options = {
		host: process.env.TIDB_HOST || '127.0.0.1',
		port: process.env.TIDB_PORT ? parseInt(process.env.TIDB_PORT) : 4000,
		user: process.env.TIDB_USER || 'root',
		password: process.env.TIDB_PASSWORD || '',
		database: db || null,
		ssl: {
			minVersion: 'TLSv1.2',
			rejectUnauthorized: false,
		},
		namedPlaceholders: true
	}

	const conn = await createConnection(options);

	return conn;
}

