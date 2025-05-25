/* eslint-disable */

import { queryOptions, useMutation } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";

// This file contains utility functions for creating query and mutation options from hono endpoints
// Usually you wouldn't need to change anything here unless you want to change how the fetching is done or want to change something about the types

type Parameter<T> = T extends (arg: infer T) => any ? T : never;
const fetcher = async <T extends (arg: any) => any>(
  fn: T,
  data: Parameter<T>
): Promise<InferResponseType<T>> => {
  const res: any = await fn(data);

  if (!res.ok) {
    let error;
    try {
      error = await res.clone().json();
    } catch {
      error = await res.clone().text();
    }
    throw error;
  }

  const json = await res.json();

  return json;
};

export function createHonoQueryOptions<
  T extends (...args: any) => Promise<any>
>(
  queryKey: string[] | ((data: Parameter<T>) => string[]),
  endpoint: T
): Parameter<T> extends undefined | void | Record<string, never>
  ? (
      data?: Parameter<T>,
      options?: Omit<Parameters<typeof queryOptions>[0], "queryKey" | "queryFn">
    ) => ReturnType<
      typeof queryOptions<InferResponseType<typeof endpoint, 200>>
    >
  : (
      data: Parameter<T>,
      options?: Omit<Parameters<typeof queryOptions>[0], "queryKey" | "queryFn">
    ) => ReturnType<
      typeof queryOptions<InferResponseType<typeof endpoint, 200>>
    > {
  return ((data: any, options: Parameters<typeof queryOptions>[0]) =>
    queryOptions({
      ...options,
      queryKey: Array.isArray(queryKey) ? queryKey : queryKey(data),
      queryFn: async () => {
        return (await fetcher(endpoint, data)) as InferResponseType<
          typeof endpoint,
          200
        >;
      },
    })) as any;
}

export type Or<T, K> = keyof K extends never ? T | void : T;

export type ValidationError = string | string[];

export type ValidationErrors = Record<string, ValidationError>;

type UseMutationParams<T extends (...args: any) => Promise<any>> = Parameters<
  typeof useMutation<
    InferResponseType<T, 200>,
    ValidationErrors,
    // Since json is the most commonly used type of body, we'll infer it and use it as the default data type for the mutation
    // However if the endpoint does not have a json property, we'll fallback to the default data type
    // Basically, this prevents you from writing .mutate({ json: { ... } }) over and over again and allows you to just write .mutate({ ... })
    "json" extends keyof InferRequestType<T>
      ? Or<
          InferRequestType<T>["json"] & {
            options?: Partial<Omit<InferRequestType<T>, "json">>;
          },
          InferRequestType<T>["json"]
        >
      : InferRequestType<T>
  >
>;

type ErrorStatusCodes = 400 | 401 | 403 | 404 | 500;

// There is probably a simpler way to do this but this'll do for now

type OnErrorMutationOption<T extends (...args: any) => Promise<any>> =
  | ((
      error: InferResponseType<T, ErrorStatusCodes> extends never
        ? unknown
        : InferResponseType<T, ErrorStatusCodes>,
      variables: Parameters<
        Exclude<Pick<UseMutationParams<T>[0], "onError">["onError"], undefined>
      >[1],
      context: Parameters<
        Exclude<Pick<UseMutationParams<T>[0], "onError">["onError"], undefined>
      >[2]
    ) => ReturnType<
      Exclude<Pick<UseMutationParams<T>[0], "onError">["onError"], undefined>
    >)
  | undefined;

type CustomMutationOptions<T extends (...args: any) => Promise<any>> = Omit<
  UseMutationParams<T>[0],
  "onError"
> & {
  hono?: Omit<InferRequestType<T>, "json">;
  onError?: OnErrorMutationOption<T>;
};

export function createHonoMutationOptions<
  T extends (...args: any) => Promise<any>
>(
  endpoint: T
): (options?: CustomMutationOptions<T>) => CustomMutationOptions<T> {
  return ({ hono, ...options }: CustomMutationOptions<T> = {}) =>
    ({
      mutationFn: async (args) => {
        // Taken from https://hono.dev/docs/api/request#valid
        const targets = ["form", "json", "query", "header", "cookie", "param"];

        return await fetcher(endpoint, {
          ...(Object.keys(args as any).every((key) => targets.includes(key))
            ? args
            : { json: args, ...args.options }),
          ...hono,
        } as any);
      },
      ...options,
    } satisfies CustomMutationOptions<T>);
}
