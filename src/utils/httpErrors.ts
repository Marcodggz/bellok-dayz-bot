export interface HttpErrorDetails {
  status?: number;
  data?: unknown;
  message: string;
}

export function getHttpErrorDetails(error: unknown): HttpErrorDetails {
  if (typeof error !== "object" || error === null) {
    return {
      message: typeof error === "string" ? error : "",
    };
  }

  const response =
    "response" in error && typeof error.response === "object" && error.response !== null
      ? error.response
      : null;

  const status =
    response && "status" in response && typeof response.status === "number"
      ? response.status
      : undefined;

  const data = response && "data" in response ? response.data : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return { status, data, message };
}
