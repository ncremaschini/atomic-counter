import { MongoClient } from "mongodb";

export const buildDocumentDbClient = async () : Promise<MongoClient> =>{
	const connectionString = process.env.DOCUMENT_DB_CONNECTION_STRING;
	
	if (!connectionString) {
		throw new Error("DOCUMENT_DB_CONNECTION_STRING is not defined");
	}
	
	const documentDBClient = new MongoClient(connectionString, { 
		monitorCommands: true,
		authSource: "admin", //this is required in order to connect to the admin database
		retryWrites: false,
	 })

	return documentDBClient;
}

