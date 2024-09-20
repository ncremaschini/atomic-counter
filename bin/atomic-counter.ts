#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { AtomicCounterStack } from '../lib/atomic-counter-stack';

const app = new cdk.App();
new AtomicCounterStack(app, 'AtomicCounterStack', {});