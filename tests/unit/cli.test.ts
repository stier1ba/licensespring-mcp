import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCli, USAGE } from '../../src/cli.js';
import { PACKAGE_VERSION } from '../../src/utils/http.js';

function deps() {
  return {
    startLicenseApi: vi.fn().mockResolvedValue(undefined),
    startManagementApi: vi.fn().mockResolvedValue(undefined),
    print: vi.fn(),
    printError: vi.fn(),
    exit: vi.fn(),
  };
}

describe('runCli', () => {
  it('starts the License API server by default', async () => {
    const d = deps();
    await runCli([], d);
    expect(d.startLicenseApi).toHaveBeenCalled();
    await runCli(['license-api'], d);
    expect(d.startLicenseApi).toHaveBeenCalledTimes(2);
  });

  it('starts the Management API server', async () => {
    const d = deps();
    await runCli(['management-api'], d);
    expect(d.startManagementApi).toHaveBeenCalled();
    expect(d.print).not.toHaveBeenCalled();
  });

  it.each(['--help', '-h'])('prints usage for %s', async (flag) => {
    const d = deps();
    await runCli([flag], d);
    expect(d.print).toHaveBeenCalledWith(USAGE);
  });

  it.each(['--version', '-v'])('prints the version for %s', async (flag) => {
    const d = deps();
    await runCli([flag], d);
    expect(d.print).toHaveBeenCalledWith(PACKAGE_VERSION);
  });

  it('rejects unknown commands', async () => {
    const d = deps();
    await runCli(['bogus'], d);
    expect(d.printError).toHaveBeenCalledWith(expect.stringContaining('Unknown server type: bogus'));
    expect(d.exit).toHaveBeenCalledWith(1);
  });
});

describe('entry points', () => {
  afterEach(() => {
    vi.doUnmock('../../src/license-api/server.js');
    vi.doUnmock('../../src/management-api/server.js');
    vi.doUnmock('../../src/cli.js');
    vi.resetModules();
  });

  it('license-api-server starts the License API server', async () => {
    const startLicenseApiServer = vi.fn();
    vi.resetModules();
    vi.doMock('../../src/license-api/server.js', () => ({ startLicenseApiServer }));
    await import('../../src/license-api-server.js');
    expect(startLicenseApiServer).toHaveBeenCalledTimes(1);
  });

  it('management-api-server starts the Management API server', async () => {
    const startManagementApiServer = vi.fn();
    vi.resetModules();
    vi.doMock('../../src/management-api/server.js', () => ({ startManagementApiServer }));
    await import('../../src/management-api-server.js');
    expect(startManagementApiServer).toHaveBeenCalledTimes(1);
  });

  it('index wires the CLI to the real process and server modules', async () => {
    const startLicenseApiServer = vi.fn();
    const startManagementApiServer = vi.fn();
    const runCliMock = vi.fn();
    vi.resetModules();
    vi.doMock('../../src/license-api/server.js', () => ({ startLicenseApiServer }));
    vi.doMock('../../src/management-api/server.js', () => ({ startManagementApiServer }));
    vi.doMock('../../src/cli.js', () => ({ runCli: runCliMock }));
    await import('../../src/index.js');

    const [args, cliDeps] = runCliMock.mock.calls[0];
    expect(args).toEqual(process.argv.slice(2));
    await cliDeps.startLicenseApi();
    await cliDeps.startManagementApi();
    expect(startLicenseApiServer).toHaveBeenCalled();
    expect(startManagementApiServer).toHaveBeenCalled();

    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    cliDeps.print('out');
    cliDeps.printError('err');
    cliDeps.exit(3);
    expect(stdout).toHaveBeenCalledWith('out\n');
    expect(stderr).toHaveBeenCalledWith('err\n');
    expect(exit).toHaveBeenCalledWith(3);
  });
});
