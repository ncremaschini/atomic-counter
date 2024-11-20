import * as TiDbClientFactory from '../lib/lambda/tiDB/clientFactory/tiDbClientFactory';

import { Connection } from "mysql2/promise";
import { RowDataPacket } from 'mysql2';
import { handler as incrementerHandler } from '../lib/lambda/tiDB/counterLambda';

const insertOkResult = [[[],{fieldCount: 0,affectedRows: 1,insertId: 0,info: '',serverStatus: 10,warningStatus: 0,changedRows: 0},[ { counter_value: 1 } ],{fieldCount: 0,affectedRows: 0,insertId: 0,info: '',serverStatus: 2,warningStatus: 0,changedRows: 0}]];
const updateOkResult = [[[ { counter_value: 1 } ],{fieldCount: 0,affectedRows: 2,insertId: 0,info: '',serverStatus: 10,warningStatus: 0,changedRows: 0},[ { counter_value: 2 } ],{fieldCount: 0,affectedRows: 0,insertId: 0,info: '',serverStatus: 2,warningStatus: 0,changedRows: 0}]];
const updateKoResult = [[[ { counter_value: 9 } ],{fieldCount: 0,affectedRows: 1,insertId: 0,info: '',serverStatus: 10,warningStatus: 0,changedRows: 0},[ { counter_value: 10 } ],{fieldCount: 0,affectedRows: 0,insertId: 0,info: '',serverStatus: 2,warningStatus: 0,changedRows: 0}]];

describe('handler', () => {
    const OLD_ENV = process.env;

    const queryMock = jest.fn();
    const executeMock = jest.fn();
    const endConnectionMock = jest.fn();

    const createConnectionMock = {
        query: queryMock,
        execute: executeMock,
        end: endConnectionMock
    }  as unknown as Promise<Connection>;
 
    beforeAll(async () => {

    })

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
        
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        
        queryMock.mockReset();
        executeMock.mockReset();
        endConnectionMock.mockReset();
    
        jest.spyOn(TiDbClientFactory, 'createDbConnection').mockResolvedValueOnce(createConnectionMock);

        endConnectionMock.mockResolvedValueOnce({});

    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = OLD_ENV;
    });

    it('should return status code 200 and the updated counter without conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: { id: '1' } };
        
        queryMock.mockReturnValueOnce(insertOkResult) as unknown as RowDataPacket[];
       
        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 1, useConditionalWrites: false });
    });

    it('should return status code 200 and the updated counter with conditional writes and existing counter', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        queryMock.mockResolvedValue(updateOkResult) as unknown as RowDataPacket[];

        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 2, useConditionalWrites: true });
    });

    it('should return status code 409 for max counter valued reached', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        queryMock.mockResolvedValue(updateKoResult);

        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(409) as unknown as RowDataPacket[];
        expect(JSON.parse(result.body)).toEqual({
            error: "Counter has reached its maximum value of: " + process.env.MAX_COUNTER_VALUE,
            useConditionalWrites: true
        });
    });

    it('should return status code 500 on update exception', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };
        queryMock.mockRejectedValueOnce(new Error('Internal server error'));

        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: "Internal server error",
        });
    });
});