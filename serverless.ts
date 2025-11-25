const serverlessConfiguration = {
  service: "medical-appointment-backend",
  frameworkVersion: "4",
  provider: {
    name: "aws",
    runtime: "nodejs20.x",
    region: "us-east-1",
    deploymentBucket: {
      name: "medical-appointment-backend-deployments-dev",
    },
  },
  package: {
    individually: false,
    patterns: [
      // Include binaries of Prisma for Lambda (rhel-openssl-3.0.x)
      "src/node_modules/.prisma/client-pe/**",
      "src/node_modules/.prisma/client-cl/**",
      // Include client of Prisma
      "node_modules/@prisma/client/**",
      "node_modules/.prisma/**",
      // Exclude unnecessary binaries to reduce size
      "!node_modules/@prisma/engines/**",
      "!**/*.map",
      "!**/*.ts",
      "!**/*.test.*",
      "!**/*.spec.*",
      "!**/query_engine-windows.dll.node", // Exclude Windows binary
    ],
  },
  functions: {
    appointment: {
      handler: "src/interfaces/lambdas/appointment/handler.main",
      runtime: "nodejs20.x",
      memorySize: 512,
      timeout: 20,
      events: [
        {
          http: {
            method: "POST",
            path: "/appointments",
            cors: true,
          },
        },
        {
          http: {
            method: "GET",
            path: "/appointments/{insuredId}",
            cors: true,
          },
        },
        {
          sqs: {
            arn: {
              "Fn::GetAtt": ["AppointmentsConfirmationQueue", "Arn"],
            },
            batchSize: 10,
          },
        },
      ],
      environment: {
        APPOINTMENTS_TABLE: {
          Ref: "AppointmentsTable",
        },
        SNS_TOPIC_ARN: {
          Ref: "AppointmentTopic",
        },
        DATABASE_URL_PE: "${env:DATABASE_URL_PE}",
        DATABASE_URL_CL: "${env:DATABASE_URL_CL}",
        QUEUE_PE_URL: {
          Ref: "AppointmentsPeQueue",
        },
        QUEUE_CL_URL: {
          Ref: "AppointmentsClQueue",
        },
        CONFIRMATION_QUEUE_URL: {
          Ref: "AppointmentsConfirmationQueue",
        },
      },
      iam: {
        role: {
          statements: [
            {
              Effect: "Allow",
              Action: [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:Query",
                "dynamodb:UpdateItem",
              ],
              Resource: {
                "Fn::GetAtt": ["AppointmentsTable", "Arn"],
              },
            },
            {
              Effect: "Allow",
              Action: ["sns:Publish"],
              Resource: {
                Ref: "AppointmentTopic",
              },
            },
            {
              Effect: "Allow",
              Action: ["sqs:SendMessage"],
              Resource: [
                {
                  "Fn::GetAtt": ["AppointmentsPeQueue", "Arn"],
                },
                {
                  "Fn::GetAtt": ["AppointmentsClQueue", "Arn"],
                },
                {
                  "Fn::GetAtt": ["AppointmentsConfirmationQueue", "Arn"],
                },
              ],
            },
            {
              Effect: "Allow",
              Action: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
              ],
              Resource: {
                "Fn::GetAtt": ["AppointmentsConfirmationQueue", "Arn"],
              },
            },
          ],
        },
      },
    },
    appointmentPe: {
      handler: "src/interfaces/lambdas/appointmentPe/handler.main",
      runtime: "nodejs20.x",
      memorySize: 512,
      timeout: 30,
      // VPC configuration for RDS access
      vpc: {
        securityGroupIds: [
          "${env:LAMBDA_SECURITY_GROUP_ID}",
        ],
        subnetIds: [
          "${env:SUBNET_ID_1}",
          "${env:SUBNET_ID_2}",
        ],
      },
      events: [
        {
          sqs: {
            arn: {
              "Fn::GetAtt": ["AppointmentsPeQueue", "Arn"],
            },
            batchSize: 5,
          },
        },
      ],
      environment: {
        DATABASE_URL_PE: "${env:DATABASE_URL_PE}",
        QUEUE_PE_URL: {
          Ref: "AppointmentsPeQueue",
        },
      },
      iam: {
        role: {
          statements: [
            {
              Effect: "Allow",
              Action: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
              ],
              Resource: [
                {
                  "Fn::GetAtt": ["AppointmentsPeQueue", "Arn"],
                },
                {
                  "Fn::GetAtt": ["AppointmentsPeQueueDLQ", "Arn"],
                },
              ],
            },
            {
              Effect: "Allow",
              Action: ["events:PutEvents"],
              Resource: "*",
            },
            // VPC permissions - required if Lambda is in VPC
            {
              Effect: "Allow",
              Action: [
                "ec2:CreateNetworkInterface",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DeleteNetworkInterface",
                "ec2:AssignPrivateIpAddresses",
                "ec2:UnassignPrivateIpAddresses",
              ],
              Resource: "*",
            },
          ],
        },
      },
    },
    appointmentCl: {
      handler: "src/interfaces/lambdas/appointmentCl/handler.main",
      runtime: "nodejs20.x",
      memorySize: 512,
      timeout: 30,
      // VPC configuration for RDS access
      vpc: {
        securityGroupIds: [
          "${env:LAMBDA_SECURITY_GROUP_ID}",
        ],
        subnetIds: [
          "${env:SUBNET_ID_1}",
          "${env:SUBNET_ID_2}",
        ],
      },
      events: [
        {
          sqs: {
            arn: {
              "Fn::GetAtt": ["AppointmentsClQueue", "Arn"],
            },
            batchSize: 5,
          },
        },
      ],
      environment: {
        DATABASE_URL_CL: "${env:DATABASE_URL_CL}",
        QUEUE_CL_URL: {
          Ref: "AppointmentsClQueue",
        },
      },
      iam: {
        role: {
          statements: [
            {
              Effect: "Allow",
              Action: [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
              ],
              Resource: [
                {
                  "Fn::GetAtt": ["AppointmentsClQueue", "Arn"],
                },
                {
                  "Fn::GetAtt": ["AppointmentsClQueueDLQ", "Arn"],
                },
              ],
            },
            {
              Effect: "Allow",
              Action: ["events:PutEvents"],
              Resource: "*",
            },
            // VPC permissions - required if Lambda is in VPC
            {
              Effect: "Allow",
              Action: [
                "ec2:CreateNetworkInterface",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DeleteNetworkInterface",
                "ec2:AssignPrivateIpAddresses",
                "ec2:UnassignPrivateIpAddresses",
              ],
              Resource: "*",
            },
          ],
        },
      },
    },
  },
  resources: {
    Resources: {
      AppointmentTopic: {
        Type: "AWS::SNS::Topic",
        Properties: {
          TopicName: "appointment-topic",
        },
      },
      AppointmentsTable: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: "Appointments",
          BillingMode: "PAY_PER_REQUEST",
          AttributeDefinitions: [
            {
              AttributeName: "insuredId",
              AttributeType: "S",
            },
            {
              AttributeName: "appointmentId",
              AttributeType: "S",
            },
          ],
          KeySchema: [
            {
              AttributeName: "insuredId",
              KeyType: "HASH",
            },
            {
              AttributeName: "appointmentId",
              KeyType: "RANGE",
            },
          ],
        },
      },
      AppointmentsPeQueue: {
        Type: "AWS::SQS::Queue",
        DependsOn: ["AppointmentTopic"],
        Properties: {
          QueueName: "appointments-pe-queue",
          VisibilityTimeout: 60,
          MessageRetentionPeriod: 1209600,
          ReceiveMessageWaitTimeSeconds: 20,
          RedrivePolicy: {
            deadLetterTargetArn: {
              "Fn::GetAtt": ["AppointmentsPeQueueDLQ", "Arn"],
            },
            maxReceiveCount: 3,
          },
        },
      },
      AppointmentsPeQueueDLQ: {
        Type: "AWS::SQS::Queue",
        Properties: {
          QueueName: "appointments-pe-queue-dlq",
          MessageRetentionPeriod: 1209600,
        },
      },
      AppointmentsPeQueuePolicy: {
        Type: "AWS::SQS::QueuePolicy",
        DependsOn: ["AppointmentsPeQueue", "AppointmentTopic"],
        Properties: {
          Queues: [
            {
              Ref: "AppointmentsPeQueue",
            },
          ],
          PolicyDocument: {
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  Service: "sns.amazonaws.com",
                },
                Action: "sqs:SendMessage",
                Resource: {
                  "Fn::GetAtt": ["AppointmentsPeQueue", "Arn"],
                },
                Condition: {
                  ArnEquals: {
                    "aws:SourceArn": {
                      Ref: "AppointmentTopic",
                    },
                  },
                },
              },
            ],
          },
        },
      },
      AppointmentsClQueue: {
        Type: "AWS::SQS::Queue",
        DependsOn: ["AppointmentTopic"],
        Properties: {
          QueueName: "appointments-cl-queue",
          VisibilityTimeout: 60,
          MessageRetentionPeriod: 1209600,
          ReceiveMessageWaitTimeSeconds: 20,
          RedrivePolicy: {
            deadLetterTargetArn: {
              "Fn::GetAtt": ["AppointmentsClQueueDLQ", "Arn"],
            },
            maxReceiveCount: 3,
          },
        },
      },
      AppointmentsClQueueDLQ: {
        Type: "AWS::SQS::Queue",
        Properties: {
          QueueName: "appointments-cl-queue-dlq",
          MessageRetentionPeriod: 1209600,
        },
      },
      AppointmentsClQueuePolicy: {
        Type: "AWS::SQS::QueuePolicy",
        DependsOn: ["AppointmentsClQueue", "AppointmentTopic"],
        Properties: {
          Queues: [
            {
              Ref: "AppointmentsClQueue",
            },
          ],
          PolicyDocument: {
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  Service: "sns.amazonaws.com",
                },
                Action: "sqs:SendMessage",
                Resource: {
                  "Fn::GetAtt": ["AppointmentsClQueue", "Arn"],
                },
                Condition: {
                  ArnEquals: {
                    "aws:SourceArn": {
                      Ref: "AppointmentTopic",
                    },
                  },
                },
              },
            ],
          },
        },
      },
      AppointmentsConfirmationQueue: {
        Type: "AWS::SQS::Queue",
        Properties: {
          QueueName: "appointments-confirmation-queue",
        },
      },
      AppointmentsConfirmationQueuePolicy: {
        Type: "AWS::SQS::QueuePolicy",
        DependsOn: ["AppointmentsConfirmationQueue"],
        Properties: {
          Queues: [
            {
              Ref: "AppointmentsConfirmationQueue",
            },
          ],
          PolicyDocument: {
            Statement: [
              {
                Effect: "Allow",
                Principal: {
                  Service: "events.amazonaws.com",
                },
                Action: "sqs:SendMessage",
                Resource: {
                  "Fn::GetAtt": ["AppointmentsConfirmationQueue", "Arn"],
                },
              },
            ],
          },
        },
      },
      AppointmentTopicSubscriptionPe: {
        Type: "AWS::SNS::Subscription",
        DependsOn: ["AppointmentsPeQueue"],
        Properties: {
          TopicArn: {
            Ref: "AppointmentTopic",
          },
          Endpoint: {
            "Fn::GetAtt": ["AppointmentsPeQueue", "Arn"],
          },
          Protocol: "sqs",
          FilterPolicy: {
            countryISO: ["PE"],
          },
          FilterPolicyScope: "MessageAttributes",
        },
      },
      AppointmentTopicSubscriptionCl: {
        Type: "AWS::SNS::Subscription",
        DependsOn: ["AppointmentsClQueue"],
        Properties: {
          TopicArn: {
            Ref: "AppointmentTopic",
          },
          Endpoint: {
            "Fn::GetAtt": ["AppointmentsClQueue", "Arn"],
          },
          Protocol: "sqs",
          FilterPolicy: {
            countryISO: ["CL"],
          },
          FilterPolicyScope: "MessageAttributes",
        },
      },
      AppointmentCompletedRule: {
        Type: "AWS::Events::Rule",
        DependsOn: ["AppointmentsConfirmationQueue"],
        Properties: {
          EventPattern: {
            source: ["appointment.service"],
            "detail-type": ["AppointmentCompleted"],
          },
          Targets: [
            {
              Arn: {
                "Fn::GetAtt": ["AppointmentsConfirmationQueue", "Arn"],
              },
              Id: "AppointmentsConfirmationQueueTarget",
            },
          ],
        },
      },
    },
    Outputs: {
      AppointmentTopicArn: {
        Description: "ARN del SNS Topic appointment-topic",
        Value: {
          Ref: "AppointmentTopic",
        },
        Export: {
          Name: {
            "Fn::Sub": "${AWS::StackName}-AppointmentTopicArn",
          },
        },
      },
      AppointmentsTableArn: {
        Description: "ARN de la tabla DynamoDB Appointments",
        Value: {
          "Fn::GetAtt": ["AppointmentsTable", "Arn"],
        },
        Export: {
          Name: {
            "Fn::Sub": "${AWS::StackName}-AppointmentsTableArn",
          },
        },
      },
      AppointmentsTableName: {
        Description: "Nombre de la tabla DynamoDB Appointments",
        Value: {
          Ref: "AppointmentsTable",
        },
        Export: {
          Name: {
            "Fn::Sub": "${AWS::StackName}-AppointmentsTableName",
          },
        },
      },
    },
  },
};

export = serverlessConfiguration;

