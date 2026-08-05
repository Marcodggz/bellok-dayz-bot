import { describe, expect, test } from "vitest";

import { getHttpErrorDetails } from "../../src/utils/httpErrors.ts";

describe("getHttpErrorDetails", () => {
  test("returns a string error as the message", () => {
    expect(getHttpErrorDetails("request failed")).toEqual({
      message: "request failed",
    });
  });

  test.each([undefined, null, 42, true])(
    "returns an empty message for non-string primitive value %s",
    (error) => {
      expect(getHttpErrorDetails(error)).toEqual({
        message: "",
      });
    }
  );

  test("extracts status, data, and message from an HTTP-style error", () => {
    const data = Buffer.from("Rate limit exceeded");

    expect(
      getHttpErrorDetails({
        message: "Request failed with status code 429",
        response: {
          status: 429,
          data,
        },
      })
    ).toEqual({
      status: 429,
      data,
      message: "Request failed with status code 429",
    });
  });

  test("keeps response data when status is absent or invalid", () => {
    expect(
      getHttpErrorDetails({
        response: {
          status: "500",
          data: { reason: "server error" },
        },
      })
    ).toEqual({
      status: undefined,
      data: { reason: "server error" },
      message: "",
    });
  });

  test("ignores null and non-object response values", () => {
    expect(
      getHttpErrorDetails({
        message: "Network error",
        response: null,
      })
    ).toEqual({
      status: undefined,
      data: undefined,
      message: "Network error",
    });

    expect(
      getHttpErrorDetails({
        message: "Network error",
        response: "invalid",
      })
    ).toEqual({
      status: undefined,
      data: undefined,
      message: "Network error",
    });
  });

  test("ignores a non-string message", () => {
    expect(
      getHttpErrorDetails({
        message: 500,
        response: {
          status: 500,
        },
      })
    ).toEqual({
      status: 500,
      data: undefined,
      message: "",
    });
  });
});
