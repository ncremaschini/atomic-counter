import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as dotenv from "dotenv";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as fs from 'fs';
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from 'path';

import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

import { Construct } from 'constructs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { TlsCertificate } from 'aws-cdk-lib/aws-appmesh';

dotenv.config();

const USE_CONDITIONAL_WRITES = process.env.USE_CONDITIONAL_WRITES || 'false';
const MAX_COUNTER_VALUE = process.env.MAX_COUNTER_VALUE || '10';
const MOMENTO_CACHE_NAME = process.env.MOMENTO_CACHE_NAME || 'cache';

export class AtomicCounterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new cdk.aws_ec2.Vpc(this, "AtomicCounterVpc", {
      vpcName: "AtomicCounterVpc",
      maxAzs: 2,
      ipAddresses: cdk.aws_ec2.IpAddresses.cidr("10.0.0.0/23"),

      subnetConfiguration: [
        {
          name: "atc-public",
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          cidrMask: 25,
          mapPublicIpOnLaunch: true,
          reserved: false,
        },
        {
          name: "atc-private",
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 25,
          reserved: false,
        },
      ],
      natGateways: 1,
      createInternetGateway: true,
    });

    // create a security group for the redis cluster
    const redisSecurityGroup = new cdk.aws_ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for Redis cluster',
      securityGroupName: 'redis-sg',
    });

    //create a security group for documentdb cluster
    const docdbSecurityGroup = new cdk.aws_ec2.SecurityGroup(this, 'DocDBSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for DocumentDB cluster',
      securityGroupName: 'docdb-sg',
    });

    //create a security group for the lambda function
   const lambdaSecurityGroup = new cdk.aws_ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for Lambda function',
      securityGroupName: 'lambda-sg',
    });

    redisSecurityGroup.addIngressRule(lambdaSecurityGroup, cdk.aws_ec2.Port.tcp(6379), 'Allow inbound traffic on port 6379');
    docdbSecurityGroup.addIngressRule(lambdaSecurityGroup, cdk.aws_ec2.Port.tcp(27017), 'Allow inbound traffic on port 27017');
    
    // create a dynamodb table name atomic-counter with a primary key of 'id' and a numeric attribute 'counter''
    const table = new cdk.aws_dynamodb.Table(this, 'AtomicCounterTable', {
      tableName: 'atomic-counter',
      partitionKey: { name: 'id', type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PROVISIONED,
      readCapacity: 10,
      writeCapacity: 10,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    //create a subnet group for the redis cluster
    const subnetGroup = new cdk.aws_elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      cacheSubnetGroupName: 'redis-subnet-group',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    // create a redis cluster with 1 shard and 1 replica inside the vpc
    const redis = new cdk.aws_elasticache.CfnCacheCluster(this, 'AtomicCounterRedis', {
      engine: 'redis',
      clusterName: 'atomic-counter-redis',
      numCacheNodes: 1,
      cacheNodeType: 'cache.t3.micro',
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
    });
    redis.addDependency(subnetGroup);

    //create a secret as a string in secrets manager for the documentdb admin password
    const docdbAdminPassword = new cdk.aws_secretsmanager.Secret(this, 'DocDBAdminPassword', {
      secretName: 'atomic-counter/docdb-admin-password',
      generateSecretString: {
        passwordLength: 20,
        excludePunctuation: true,
      },
    });
    const docdbParameterGroup = new cdk.aws_docdb.ClusterParameterGroup(this, 'DocDBParameterGroup', {
      description: 'Parameter group for DocumentDB cluster',
      family: 'docdb5.0',
      parameters: {
        ttl_monitor: 'enabled',
        tls: 'disabled', // TLS is disabled for brevity in this example, but should be enabled in production
      },
    });
  
    const docdbCluster = new cdk.aws_docdb.DatabaseCluster(this, 'AtomicCounterDocDBCluster', {
      dbClusterName: 'atomic-counter-docdb-cluster',
      parameterGroup: docdbParameterGroup,
      masterUser: {
        username: 'adminUser',
        password: docdbAdminPassword.secretValue,
      },
      instanceType: cdk.aws_ec2.InstanceType.of(cdk.aws_ec2.InstanceClass.T4G, cdk.aws_ec2.InstanceSize.MEDIUM),
      vpcSubnets: { 
        subnets: vpc.privateSubnets 
      },  
      instances: 1,
      vpc : vpc,
      securityGroup: docdbSecurityGroup,
      removalPolicy: cdk.RemovalPolicy.DESTROY,    
    });

    const nodeJsFunctionProps: NodejsFunctionProps = {
      memorySize: 512,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
    };

    //create a lambda functiiion that will increment the counter in the dynamodb table
    const dynamoLambda = new NodejsFunction(this, 'AtomicCounterDynamoLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'dynamo', 'index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterDynamoLambda',
      description: 'Function to increment counter in DynamoDB',
      handler: 'index.handler',
      environment: {
        TABLE_NAME: table.tableName,
        USE_CONDITIONAL_WRITES: USE_CONDITIONAL_WRITES,
        MAX_COUNTER_VALUE: MAX_COUNTER_VALUE
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    // grant the lambda function read/write permissions to the dynamodb table
    table.grantReadWriteData(dynamoLambda);

    //create a lambda function that will increment the counter in the redis cluster
    const redisLambda = new NodejsFunction(this, 'AtomicCounterRedisLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'redis', 'index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterRedisLambda',
      description: 'Function to increment counter in Redis',
      handler: 'index.handler',
      environment: {
        REDIS_URL: redis.attrRedisEndpointAddress,
        REDIS_PORT: redis.attrRedisEndpointPort,
        USE_CONDITIONAL_WRITES: USE_CONDITIONAL_WRITES,
        MAX_COUNTER_VALUE: MAX_COUNTER_VALUE
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    const momentoKeyInfoPath = path.join(__dirname, '../momento_key_info.json');
    const momentoKeyInfo = JSON.parse(fs.readFileSync(momentoKeyInfoPath, 'utf8'));
    
    //create a lambda function that will increment the counter in momento db
    const momentoLambda = new NodejsFunction(this, 'AtomicCounterMomentoLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'momento', 'index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterMomentoLambda',
      description: 'Function to increment counter in Momento',
      handler: 'index.handler',
      environment: {
        USE_CONDITIONAL_WRITES: USE_CONDITIONAL_WRITES,
        MAX_COUNTER_VALUE: MAX_COUNTER_VALUE,
        MOMENTO_API_KEY: momentoKeyInfo.apiKey, 
        MOMENTO_ENDPOINT: momentoKeyInfo.endpoint,
        MOMENTO_CACHE_NAME: MOMENTO_CACHE_NAME
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    const connectionString = `mongodb://adminUser:${docdbAdminPassword.secretValue.unsafeUnwrap()}@${docdbCluster.clusterEndpoint.hostname}:${docdbCluster.clusterEndpoint.port}/atomic_counter`;

    const docdbLambda = new NodejsFunction(this, 'AtomicCounterDocDbLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'documentDB', 'counterLambda','index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterDocDbLambda',
      description: 'Function to increment counter in DocumentDB',
      handler: 'index.handler',
      environment: {
        USE_CONDITIONAL_WRITES: USE_CONDITIONAL_WRITES,
        MAX_COUNTER_VALUE: MAX_COUNTER_VALUE,
        DOCUMENT_DB_CONNECTION_STRING: connectionString
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    const docdbSetupLambda = new NodejsFunction(this, 'AtomicCounterDocDbSetupLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'documentDB', 'setupLambda','index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterDocDbSetupLambda',
      description: 'Function to setup DocumentDB',
      handler: 'index.handler',
      environment: {
        DOCUMENT_DB_CONNECTION_STRING: connectionString
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    const tidbInfoPath = path.join(__dirname, '../tidb_info.json');
    const tidbInfo = JSON.parse(fs.readFileSync(tidbInfoPath, 'utf8'));

    const tidbLambda = new NodejsFunction(this, 'AtomicCounterTiDbLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'tiDB', 'counterLambda','index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterTiDbLambda',
      description: 'Function to increment counter in TiDB',
      handler: 'index.handler',
      environment: {
        TIDB_HOST: tidbInfo.host,
        TIDB_PORT: tidbInfo.port,
        TIDB_USER: tidbInfo.user,
        TIDB_PASSWORD: tidbInfo.pwd,
        TIDB_DATABASE: tidbInfo.db,
        USE_CONDITIONAL_WRITES: USE_CONDITIONAL_WRITES,
        MAX_COUNTER_VALUE: MAX_COUNTER_VALUE
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    const tidbSetupLambda = new NodejsFunction(this, 'AtomicCounterTiDbSetupLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'tiDB', 'setupLambda','index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterTiDbSetupLambda',
      description: 'Function to setup TiDB',
      handler: 'index.handler',
      environment: {
        TIDB_HOST: tidbInfo.host,
        TIDB_PORT: tidbInfo.port,
        TIDB_USER: tidbInfo.user,
        TIDB_PASSWORD: tidbInfo.pwd,
        TIDB_DATABASE: tidbInfo.db,
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    //create the trigger to the lambda function that creates required index on documentdb
    new events.Rule(this, "DeploymentHook", {
      eventPattern: {
        detailType: ["CloudFormation Stack Status Change"],
        source: ["aws.cloudformation"],
        detail: {
          "stack-id": [cdk.Stack.of(this).stackId],
          "status-details": {
            status: ["CREATE_COMPLETE", "UPDATE_COMPLETE"],
          },
        },
      },
      targets: [new eventsTargets.LambdaFunction(docdbSetupLambda),
                new eventsTargets.LambdaFunction(tidbSetupLambda)],
    });
    
    //grant eventbridge rule permissions to execute the lambda function
    docdbSetupLambda.addPermission('AllowEvents', {
      principal: new cdk.aws_iam.ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });

    //grant eventbridge rule permissions to execute the lambda function
    tidbSetupLambda.addPermission('AllowEvents', {
      principal: new cdk.aws_iam.ServicePrincipal('events.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });
    
    const api = new cdk.aws_apigateway.RestApi(this, 'AtomicCounterApi', {
      restApiName: 'AtomicCounterApi',
      description: 'API for Atomic Counter increment on redis and dynamodb',
      defaultCorsPreflightOptions: {
        allowOrigins: cdk.aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      },
      //add id path parameter to the api
      defaultMethodOptions: {
        requestParameters: {
          'method.request.path.id': true,
        },
      },
    });

    //create a request validator for the api to check id path parameter
    const requestValidator = new cdk.aws_apigateway.RequestValidator(this, 'AtomicCounterRequestValidator', {
      restApi: api,
      validateRequestBody: false,
      validateRequestParameters: true,
      requestValidatorName: 'validate-id-param',
    });

    const dynamoResource = api.root.addResource('dynamo');
    const dynamoIdResource = dynamoResource.addResource('{id}');
    const dynamoIntegration = new cdk.aws_apigateway.LambdaIntegration(dynamoLambda);
    
    dynamoIdResource.addMethod('POST', dynamoIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator
    });

    const redisResource = api.root.addResource('redis');
    const redisIdResource = redisResource.addResource('{id}');
    const redisIntegration = new cdk.aws_apigateway.LambdaIntegration(redisLambda);

    redisIdResource.addMethod('POST', redisIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator
    })

    const momentoResource = api.root.addResource('momento');
    const momentoIdResource = momentoResource.addResource('{id}');
    const momentoIntegration = new cdk.aws_apigateway.LambdaIntegration(momentoLambda);
    
    momentoIdResource.addMethod('POST', momentoIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator
    });

    const docDbResource = api.root.addResource('docdb');
    const docDbIdResource = docDbResource.addResource('{id}');
    const docDbIntegration = new cdk.aws_apigateway.LambdaIntegration(docdbLambda);
    
    docDbIdResource.addMethod('POST', docDbIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator
    });

    const tiDbResource = api.root.addResource('tidb');
    const tiDbIdResource = tiDbResource.addResource('{id}');
    const tiDbIntegration = new cdk.aws_apigateway.LambdaIntegration(tidbLambda);
    
    tiDbIdResource.addMethod('POST', tiDbIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator
    });

    const plan = api.addUsagePlan('AtomicCounterUsagePlan', {
      name: 'AtomicCounterUsagePlan',
      throttle: { burstLimit: 500, rateLimit: 1000 },
      quota: { limit: 1000000, period: cdk.aws_apigateway.Period.DAY },
      apiStages: [{ api, stage: api.deploymentStage }],
    });

    //add an api key to the usage plan
    const key = api.addApiKey('AtomicCounterApiKey');
    plan.addApiKey(key);

    //print out the api key
    new cdk.CfnOutput(this, 'AtomicCounterApiKey', { value: key.keyId });

    new logs.MetricFilter(this, "DynamoLambdaMetricFilter", {
      logGroup: dynamoLambda.logGroup,
      metricNamespace: "AtomicCounter",
      metricName: "DynamoAtomicCounter",
      filterPattern: logs.FilterPattern.exists("$.counter"),
      metricValue: "$.counter",
      defaultValue: 0,
      unit: cloudwatch.Unit.COUNT,
    });

    new logs.MetricFilter(this, "RedisLambdaMetricFilter", {
      logGroup: redisLambda.logGroup,
      metricNamespace: "AtomicCounter",
      metricName: "RedisAtomicCounter",
      filterPattern: logs.FilterPattern.exists("$.counter"),
      metricValue: "$.counter",
      defaultValue: 0,
      unit: cloudwatch.Unit.COUNT,
    });

    new logs.MetricFilter(this, "MomentoLambdaMetricFilter", {
      logGroup: momentoLambda.logGroup,
      metricNamespace: "AtomicCounter",
      metricName: "MomentoAtomicCounter",
      filterPattern: logs.FilterPattern.exists("$.counter"),
      metricValue: "$.counter",
      defaultValue: 0,
      unit: cloudwatch.Unit.COUNT,
    });

    new logs.MetricFilter(this, "DocDbLambdaMetricFilter", {
      logGroup: docdbLambda.logGroup,
      metricNamespace: "AtomicCounter",
      metricName: "DocDbAtomicCounter",
      filterPattern: logs.FilterPattern.exists("$.counter"),
      metricValue: "$.counter",
      defaultValue: 0,
      unit: cloudwatch.Unit.COUNT,
    });

    new logs.MetricFilter(this, "TiDbLambdaMetricFilter", {
      logGroup: docdbLambda.logGroup,
      metricNamespace: "AtomicCounter",
      metricName: "TiDbAtomicCounter",
      filterPattern: logs.FilterPattern.exists("$.counter"),
      metricValue: "$.counter",
      defaultValue: 0,
      unit: cloudwatch.Unit.COUNT,
    });
  }
}
