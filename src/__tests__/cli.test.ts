import { jest } from '@jest/globals';
import { parseArgs, runCli, USAGE, type CliDeps, type ServerKind } from '../cli.js';
import { VERSION } from '../version.js';

describe('parseArgs', () => {
  it.each([
    [[], { type: 'start', server: 'license-api' }],
    [['license-api'], { type: 'start', server: 'license-api' }],
    [['management-api'], { type: 'start', server: 'management-api' }],
    [['--help'], { type: 'help' }],
    [['-h'], { type: 'help' }],
    [['--version'], { type: 'version' }],
    [['-v'], { type: 'version' }],
  ])('%p -> %p', (argv, expected) => {
    expect(parseArgs(argv)).toEqual(expected);
  });

  it('rejects unknown server types', () => {
    expect(parseArgs(['nope'])).toEqual({ type: 'error', message: expect.stringContaining('Unknown server type: nope') });
  });
});

describe('runCli', () => {
  function deps() {
    const out: string[] = [];
    const err: string[] = [];
    const started: ServerKind[] = [];
    const d: CliDeps & { exit: jest.Mock } = {
      stdout: { write: (c: string) => out.push(c) },
      stderr: { write: (c: string) => err.push(c) },
      exit: jest.fn(),
      start: async (s) => { started.push(s); },
    };
    return { d, out, err, started };
  }

  it('prints usage for --help', async () => {
    const { d, out, started } = deps();
    await runCli(['--help'], d);
    expect(out.join('')).toBe(USAGE);
    expect(USAGE).toContain('LICENSE_CLIENT_ID');
    expect(started).toEqual([]);
  });

  it('prints the version', async () => {
    const { d, out } = deps();
    await runCli(['--version'], d);
    expect(out.join('')).toBe(`${VERSION}\n`);
  });

  it('starts the requested server without writing to stdout', async () => {
    const { d, out, started } = deps();
    await runCli([], d);
    await runCli(['management-api'], d);
    expect(started).toEqual(['license-api', 'management-api']);
    expect(out).toEqual([]);
  });

  it('reports unknown arguments on stderr and exits 1', async () => {
    const { d, out, err } = deps();
    await runCli(['bogus'], d);
    expect(err.join('')).toContain('Unknown server type: bogus');
    expect(out).toEqual([]);
    expect(d.exit).toHaveBeenCalledWith(1);
  });
});
