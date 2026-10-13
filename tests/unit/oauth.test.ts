import { describe, expect, it, vi } from 'vitest';
import { OAuthTokenProvider } from '../../src/utils/oauth.js';

function provider(responses: unknown[], now = () => 0) {
  const post = vi.fn();
  for (const data of responses) post.mockResolvedValueOnce({ data });
  return {
    post,
    provider: new OAuthTokenProvider({ tokenUrl: 'https://auth.test/token', clientId: 'cid', clientSecret: 'secret', http: { post } as never, now }),
  };
}

describe('OAuthTokenProvider', () => {
  it('requests a client-credentials token and caches it', async () => {
    const { post, provider: tokens } = provider([{ access_token: 'tok', expires_in: 480 }]);
    await expect(tokens.getToken()).resolves.toBe('tok');
    await expect(tokens.getToken()).resolves.toBe('tok');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      'https://auth.test/token',
      'grant_type=client_credentials&client_id=cid&client_secret=secret',
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
  });

  it('shares a single in-flight request between concurrent callers', async () => {
    const { post, provider: tokens } = provider([{ access_token: 'tok', expires_in: 480 }]);
    const [a, b] = await Promise.all([tokens.getToken(), tokens.getToken()]);
    expect([a, b]).toEqual(['tok', 'tok']);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('refreshes the token before it expires', async () => {
    let now = 0;
    const { post, provider: tokens } = provider([{ access_token: 'one', expires_in: 60 }, { access_token: 'two' }], () => now);
    await expect(tokens.getToken()).resolves.toBe('one');
    now = 29_000;
    await expect(tokens.getToken()).resolves.toBe('one');
    now = 30_000; // 60s lifetime minus 30s refresh skew
    await expect(tokens.getToken()).resolves.toBe('two');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('fetches a new token after invalidate()', async () => {
    const { post, provider: tokens } = provider([{ access_token: 'one', expires_in: 480 }, { access_token: 'two', expires_in: 10 }]);
    await tokens.getToken();
    tokens.invalidate();
    await expect(tokens.getToken()).resolves.toBe('two');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('rejects responses without an access token and allows a retry', async () => {
    const { provider: tokens } = provider([{}, undefined, { access_token: 'ok' }]);
    await expect(tokens.getToken()).rejects.toThrow('did not include an access_token');
    await expect(tokens.getToken()).rejects.toThrow('did not include an access_token');
    await expect(tokens.getToken()).resolves.toBe('ok');
  });

  it('creates its own HTTP client by default', () => {
    const tokens = new OAuthTokenProvider({ tokenUrl: 'https://t', clientId: 'c', clientSecret: 's', timeoutMs: 5 });
    expect(tokens).toBeInstanceOf(OAuthTokenProvider);
  });
});
