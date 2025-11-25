import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { SNSClient } from "@aws-sdk/client-sns";
import type { EventBridgeClient } from "@aws-sdk/client-eventbridge";

// Tipos para las respuestas mockeadas
type MockDynamoResponse = Record<string, unknown>;
type MockSNSResponse = { MessageId: string };
type MockEventBridgeResponse = { Entries: unknown[]; FailedEntryCount: number };

// Variables para almacenar las respuestas personalizadas
let customDynamoResponse: MockDynamoResponse | null = null;
let customSNSResponse: MockSNSResponse | null = null;
let customEventBridgeResponse: MockEventBridgeResponse | null = null;

// Mock de DynamoDBDocumentClient
const mockDynamoDBDocumentClient = {
  send: async (_command: unknown): Promise<MockDynamoResponse> => {
    if (customDynamoResponse !== null) {
      return customDynamoResponse;
    }
    // Respuesta por defecto de éxito
    return {
      $metadata: {
        httpStatusCode: 200,
        requestId: "mock-request-id",
      },
    };
  },
} as unknown as DynamoDBDocumentClient;

// Mock de SNSClient
const mockSNSClient = {
  send: async (_command: unknown): Promise<MockSNSResponse> => {
    if (customSNSResponse !== null) {
      return customSNSResponse;
    }
    return { MessageId: "123" };
  },
} as unknown as SNSClient;

// Mock de EventBridgeClient
const mockEventBridgeClient = {
  send: async (_command: unknown): Promise<MockEventBridgeResponse> => {
    if (customEventBridgeResponse !== null) {
      return customEventBridgeResponse;
    }
    return { Entries: [], FailedEntryCount: 0 };
  },
} as unknown as EventBridgeClient;

// Funciones para customizar respuestas en tests
export function getMockDynamo(): {
  mockClient: DynamoDBDocumentClient;
  overrideResponse: (response: MockDynamoResponse) => void;
  reset: () => void;
} {
  return {
    mockClient: mockDynamoDBDocumentClient,
    overrideResponse: (response: MockDynamoResponse) => {
      customDynamoResponse = response;
    },
    reset: () => {
      customDynamoResponse = null;
    },
  };
}

export function getMockSNS(): {
  mockClient: SNSClient;
  overrideResponse: (response: MockSNSResponse) => void;
  reset: () => void;
} {
  return {
    mockClient: mockSNSClient,
    overrideResponse: (response: MockSNSResponse) => {
      customSNSResponse = response;
    },
    reset: () => {
      customSNSResponse = null;
    },
  };
}

export function getMockEventBridge(): {
  mockClient: EventBridgeClient;
  overrideResponse: (response: MockEventBridgeResponse) => void;
  reset: () => void;
} {
  return {
    mockClient: mockEventBridgeClient,
    overrideResponse: (response: MockEventBridgeResponse) => {
      customEventBridgeResponse = response;
    },
    reset: () => {
      customEventBridgeResponse = null;
    },
  };
}

// Función helper para resetear todos los mocks
export function resetAllMocks(): void {
  customDynamoResponse = null;
  customSNSResponse = null;
  customEventBridgeResponse = null;
}

