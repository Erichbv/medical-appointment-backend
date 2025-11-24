import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // TODO: Implementar lógica de negocio
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Handler en desarrollo" }),
  };
};

export const main = handler;

