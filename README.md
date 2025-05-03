# @reno-stack/hono-react-query

A utility library for integrating [Hono](https://hono.dev/) RPC endpoints with [React Query](https://tanstack.com/query/latest) in your React applications.

## Features

- **Type-safe**: Leverages Hono and React Query types for full type safety.
- **Simple API**: Easily create query and mutation options from your Hono endpoints.

## Installation

```bash
npm install @reno-stack/hono-react-query
pnpm install @reno-stack/hono-react-query
yarn add @reno-stack/hono-react-query
```

## Usage

React Query has a feature called [QueryOptions](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) which is basically for creating reusable `queryFn` and `queryKey`s. By taking advantage of this. This utility gives you two functions called `createHonoQueryOptions` and `createHonoMutationOptions`. Here's how you'd use them:

For each route of our application, we'll create a `{route}.queries.ts` under a folder named `queries` in our web application (these naming conventions are arbitrary and can be changed to anything that you'd like)

Let's say we have a `notes` route and we want to create a query and a mutation for it. In `notes.queries.ts`, you would have something like this:

```typescript
import { client } from "../utils/hono-client";

import {
  createHonoMutationOptions,
  createHonoQueryOptions,
} from "@reno-stack/hono-react-query";

export const notesQueryOptions = createHonoQueryOptions(
  ["notes"],
  client.notes.$get
);

export const noteByIdQueryOptions = createHonoQueryOptions(
  ({ param: { id } }) => ["notes", id],
  client.notes[":id"].$get
);

export const createNoteMutationOptions = createHonoMutationOptions(
  client.notes.$post
);
```

We only need to pass the endpoint returned from our Hono RPC's client and the rest is handled by the utility. This utility takes cares of the problems mentioned above and here's how we would use them:

### Queries

For an endpoint that doesn't take any parameters, you can just do:

```typescript
const notesQuery = useQuery(notesQueryOptions());
```

Simple as that! and when it's time to invalidate any of these queries, you could do something like:

```typescript
await queryClient.invalidateQueries({
  queryKey: notesQueryOptions().queryKey,
});
```

However if your endpoint takes parameters, you can do:

```typescript
const noteByIdQuery = useQuery(
  noteByIdQueryOptions({ param: { id } }, { enabled: !!id })
);
```

As you can see, the first argument (which is required) is the parameters for the endpoint and the second argument is the options for the query.

### Mutations

Here's how you'd use the `createNoteMutationOptions` function defined earlier:

```typescript
const createNoteMutation = useMutation(createNoteMutationOptions());
```

And when it's time for mutating, you can do:

```typescript
createNoteMutation.mutate({ title: "New Note", content: "This is a new note" });
```

Note:
By default, this utility prioritizes the `json` property for the body of the request. If your endpoint doesn't have a `json` property, you can pass whatever is in the body of the request as the first argument. However, let's say your endpoint takes a `form` property, then you can do:

```typescript
createNoteMutation.mutate({
  form: { title: "New Note", content: "This is a new note" },
});
```

## What problem does this utility solve?

Let's say we have a `notes` router and we want to use Hono RPC alongside React Query, this is the simplest approach that could get us started:

```typescript
const notesQuery = useQuery({
  queryKey: ["notes"],
  queryFn: () => client.notes.$get(),
});
```

Simple enough, right? Except the fetch API (which Hono RPC uses under the hood) doesn't handle errors by default, so we'd need some sort of fetch wrapper that takes care of errors, okay...

```typescript
// Let's say you made a general purpose and type-safe wrapper around fetch
const fetchWrapper = (endpoint: ...) => {...}

const  notesQuery = useQuery({
queryKey: ["notes"],
queryFn: () => fetchWrapper(client.notes.$get)
});
```

Now this may seem like it's fully type-safe, but it can get annoying. What if some of our endpoints occasionally return errors? We'd have to do something like `InferResponseType<typeof client.notes.$get, 200>` to get the success payload type. Not to mention you'd have to do the same for mutations and their error types.

This will result in a lot of repetition in the long run, `fetchWrapper` is repeated every time and perhaps the worst of all, our `queryKey` is a magical array. If we want to invalidate it somewhere else, we have no safe way of accessing it, unless we create a central file for keeping the keys.

As explained above in the _Usage_ section, this utility solves all of these problems by providing a simple and type-safe API.
