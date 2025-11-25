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
      timeout: 20,
      events: [
        {
          sqs: {
            arn: {
              "Fn::GetAtt": ["AppointmentsPeQueue", "Arn"],
            },
            batchSize: 10,
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
              ],
              Resource: {
                "Fn::GetAtt": ["AppointmentsPeQueue", "Arn"],
              },
            },
            {
              Effect: "Allow",
              Action: ["events:PutEvents"],
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
      timeout: 20,
      events: [
        {
          sqs: {
            arn: {
              "Fn::GetAtt": ["AppointmentsClQueue", "Arn"],
            },
            batchSize: 10,
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
              ],
              Resource: {
                "Fn::GetAtt": ["AppointmentsClQueue", "Arn"],
              },
            },
            {
              Effect: "Allow",
              Action: ["events:PutEvents"],
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

