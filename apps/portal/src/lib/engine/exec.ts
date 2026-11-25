import type { Exec } from './catalogue';

/** Failure talking to the commerce engine. `code` is the engine's own error code where it gave one (FORBIDDEN means the session is missing, expired or lacks the permission). */
export class EngineError extends Error { constructor(message: string, readonly code: string = 'ENGINE_ERROR', readonly status = 0) { super(message); } }

export interface EngineTarget { url: string; channelToken?: string }
/** GraphQL over HTTP against a cell's Admin API. The bearer token is the signed-in merchant's own session, so the engine applies their role and channel on every call. */
export function httpExec(t: EngineTarget, token: string, f: typeof fetch = fetch): Exec {
  const headers = { authorization: `Bearer ${token}`, ...(t.channelToken ? { 'vendure-token': t.channelToken } : {}) };
  const read = async (res: Response) => {
    const body = await res.json().catch(() => null) as { data?: unknown; errors?: { message: string; extensions?: { code?: string } }[] } | null;
    if (body?.errors?.length) { const e = body.errors[0]; throw new EngineError(e.message, e.extensions?.code ?? 'ENGINE_ERROR', res.status); }
    if (!res.ok || !body) throw new EngineError(`The commerce engine answered ${res.status}.`, 'ENGINE_ERROR', res.status);
    return body.data;
  };
  const run: Exec = async (query, variables) => {
    let res: Response;
    try { res = await f(t.url, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(t.channelToken ? { 'vendure-token': t.channelToken } : {}) }, body: JSON.stringify({ query, variables }) }); }
    catch (e) { throw new EngineError(`The commerce engine could not be reached: ${e instanceof Error ? e.message : 'network error'}`, 'UNREACHABLE'); }
    const body = await res.json().catch(() => null) as { data?: unknown; errors?: { message: string; extensions?: { code?: string } }[] } | null;
    if (body?.errors?.length) { const e = body.errors[0]; throw new EngineError(e.message, e.extensions?.code ?? 'ENGINE_ERROR', res.status); }
    if (!res.ok || !body) throw new EngineError(`The commerce engine answered ${res.status}.`, 'ENGINE_ERROR', res.status);
    return body.data;
  };
  /** GraphQL multipart request: the operations, a map from file slots to variable paths, then the files themselves. */
  run.upload = async (query, variables, files) => {
    const form = new FormData(); form.append('operations', JSON.stringify({ query, variables })); form.append('map', JSON.stringify(Object.fromEntries(files.map((x, i) => [String(i), [x.path]]))));
    files.forEach((x, i) => form.append(String(i), new Blob([x.file.bytes as BlobPart], { type: x.file.type }), x.file.name));
    let res: Response;
    try { res = await f(t.url, { method: 'POST', cache: 'no-store', headers: { ...headers, 'apollo-require-preflight': 'true' }, body: form }); }
    catch (e) { throw new EngineError(`The commerce engine could not be reached: ${e instanceof Error ? e.message : 'network error'}`, 'UNREACHABLE'); }
    return read(res);
  };
  return run;
}
/** Signs an administrator in to the engine. Returns the bearer token to keep in an httpOnly cookie, or null when the credentials are wrong. */
export async function engineLogin(t: EngineTarget, username: string, password: string, f: typeof fetch = fetch): Promise<{ token: string; identifier: string } | null> {
  let res: Response;
  try { res = await f(t.url, { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', ...(t.channelToken ? { 'vendure-token': t.channelToken } : {}) }, body: JSON.stringify({ query: 'mutation($u:String!,$p:String!){ login(username:$u,password:$p){ __typename ... on CurrentUser { identifier } ... on ErrorResult { message } } }', variables: { u: username, p: password } }) }); }
  catch (e) { throw new EngineError(`The commerce engine could not be reached: ${e instanceof Error ? e.message : 'network error'}`, 'UNREACHABLE'); }
  const body = await res.json().catch(() => null) as { data?: { login?: { __typename: string; identifier?: string } }; errors?: { message: string }[] } | null; const token = res.headers.get('vendure-auth-token');
  const locked = body?.errors?.find(e => e.message.startsWith('Too many attempts')); if (locked) throw new EngineError(locked.message, 'RATE_LIMITED', 429);
  if (body?.data?.login?.__typename !== 'CurrentUser' || !token) return null;
  return { token, identifier: body.data.login.identifier ?? username };
}
