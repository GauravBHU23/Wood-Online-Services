import { NextResponse } from "next/server";

// Every API route replies with this single envelope — ported from the .NET app's rule
// ("Every API returns a single { success, message } envelope, including model-validation
// failures, so the front end can surface any error as a toast").

export interface ApiSuccess<T = unknown> {
  success: true;
  message?: string;
  data?: T;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export function apiSuccess<T>(data?: T, message?: string, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, message, data }, { status });
}

export function apiError(message: string, status = 400, errors?: Record<string, string[]>) {
  return NextResponse.json<ApiFailure>({ success: false, message, errors }, { status });
}
