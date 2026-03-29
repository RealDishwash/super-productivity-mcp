export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export function jsonResponse(payload: unknown): ToolResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function textResponse(text: string): ToolResponse {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

export function errorResponse(error: unknown): ToolResponse {
  return {
    content: [
      {
        type: "text",
        text: `Error: ${getErrorMessage(error)}`,
      },
    ],
    isError: true,
  };
}

export async function handleJsonTool<T>(handler: () => Promise<T> | T): Promise<ToolResponse> {
  try {
    const payload = await handler();
    return jsonResponse(payload);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleTextTool(handler: () => Promise<string> | string): Promise<ToolResponse> {
  try {
    const message = await handler();
    return textResponse(message);
  } catch (error) {
    return errorResponse(error);
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
