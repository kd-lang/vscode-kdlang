import cp from 'child_process';
import * as net from 'net';
import { window, workspace, ProgressLocation, Disposable } from 'vscode';
import { LanguageClient, LanguageClientOptions, StreamInfo, ServerOptions, CloseAction, ErrorAction } from 'vscode-languageclient/node';
import { terminate } from 'vscode-languageclient/lib/node/processes';

import { getKdExecCommand, getWorkspaceConfig } from './utils';
import { log, outputChannel, kdlsOutputChannel } from './status';
import { once } from 'events';

export let client: LanguageClient;
export let clientDisposable: Disposable;

let crashCount = 0;
let kdlsProcess: cp.ChildProcess;

const kdexe = getKdExecCommand();
const defaultLauncherArgs: string[] = ['--json'];

function spawnLauncher(...args: string[]): cp.ChildProcess {
	const finalArgs: string[] = ['ls'].concat(...defaultLauncherArgs).concat(...args);
	log(`Spawning kd ${finalArgs.join(' ')}...`);
	return cp.spawn(kdexe, finalArgs);
}

export async function checkKdlsInstallation(): Promise<boolean> {
	const kdlsInstalled = await isKdlsInstalled();
	if (!kdlsInstalled) {
		const selected = await window.showInformationMessage('KDLS is not installed. Do you want to install it now?', 'Yes', 'No');
		if (selected === 'Yes') {
			await installKdls();
			return await isKdlsInstalled();
		} else {
			return false;
		}
	}
	return true;
}

function receiveLauncherJsonData(cb: (d: { error?: { code: number, message: string }, message: string }) => void) {
	return (rawData: string | Buffer) => {
		const data = typeof rawData == 'string' ? rawData : rawData.toString('utf8');
		log(`[kd ls] new data: ${data}`);
		cb(JSON.parse(data));
	};
}

function receiveLauncherError(rawData: string | Buffer) {
	const msg = typeof rawData === 'string' ? rawData : rawData.toString('utf8');
	const launcherMessage = `[kd ls] error: ${msg}`;
	log(launcherMessage);
	void window.showErrorMessage(launcherMessage);
}

export async function isKdlsInstalled(): Promise<boolean> {
	let isInstalled = false;
	const launcher = spawnLauncher('--check');

	launcher.stdout.on('data', receiveLauncherJsonData(({ error, message }) => {
		if (error) {
			void window.showErrorMessage(`Error (${error.code}): ${error.message}`);
		} else if (!message.includes('not installed')) {
			isInstalled = true;
		}
	}));

	launcher.stderr.on('data', receiveLauncherError);
	await once(launcher, 'close');
	return isInstalled;
}

export function isKdlsEnabled(): boolean {
	return getWorkspaceConfig().get<boolean>('kdls.enable') ?? false;
}

export async function installKdls(update = false): Promise<void> {
	try {
		await window.withProgress({
			location: ProgressLocation.Notification,
			title: update ? 'Updating KDLS' : 'Installing KDLS',
			cancellable: true,
		}, async (progress, token) => {
			const launcher = spawnLauncher(update ? '--update' : '--install');
			token.onCancellationRequested(() => launcher.kill());

			launcher.stdout.on('data', receiveLauncherJsonData((payload) => {
				if (payload.error) {
					void window.showErrorMessage(`Error (${payload.error.code}): ${payload.error.message}`);
				} else if (payload.message.includes('was updated') || payload.message.includes('was already updated')) {
					void window.showInformationMessage(payload.message);
				} else {
					progress.report(payload);
				}
			}));

			launcher.stderr.on('data', receiveLauncherError);
			await once(launcher, 'close');
		});
	} catch (e) {
		log(e);
		outputChannel.show();
		if (e instanceof Error) {
			await window.showErrorMessage(e.message);
		} else {
			await window.showErrorMessage('Failed installing KDLS. See output for more information.');
		}
	}
}

function connectVlsViaTcp(port: number): Promise<StreamInfo> {
	const socket = net.connect({ port });
	const result: StreamInfo = {
		writer: socket,
		reader: socket
	};
	return Promise.resolve(result);
}

export function connectKdls(): void {
	let shouldSpawnProcess = true;

	const connMode = getWorkspaceConfig().get<string>('kdls.connectionMode');
	const tcpPort = getWorkspaceConfig().get<number>('kdls.tcpMode.port');

	// Arguments to be passed to KDLS
	const kdlsArgs: string[] = getWorkspaceConfig().get<string>('kdls.customArgs').split(' ').filter(Boolean);
	const hasArg = (flag: string): boolean => kdlsArgs.findIndex(a => a == flag || a.startsWith(flag)) != -1;
	const pushArg = (flags: string[], value?: string | number | boolean) => {
		if ((typeof value === 'string' && value.length == 0) || value === null) {
			return;
		}

		const validFlags = flags.filter(Boolean);
		if (validFlags.length != 0 && validFlags.every(flag => !hasArg(flag))) {
			if (typeof value === 'undefined' || (typeof value === 'boolean' && value)) {
				kdlsArgs.push(validFlags[0]);
			} else {
				kdlsArgs.push(`${validFlags[0]}=${value.toString()}`);
			}
		}
	};

	pushArg(['--enable', '-e'], getWorkspaceConfig().get<string>('kdls.enableFeatures'));
	pushArg(['--disable', '-d'], getWorkspaceConfig().get<string>('kdls.disableFeatures'));
	pushArg(['--kdroot'], getWorkspaceConfig().get<string>('kdls.customKdrootPath'));
	pushArg(['--debug'], getWorkspaceConfig().get<boolean>('kdls.debug'));

	if (connMode == 'tcp') {
		pushArg(['--socket']);
		pushArg(['--port'], tcpPort);

		// This will instruct the extension to not skip launching
		// a new VLS process and use an existing one with TCP enabled instead.
		if (getWorkspaceConfig().get<boolean>('kdls.tcpMode.useRemoteServer')) {
			shouldSpawnProcess = false;
		}
	}

	if (shouldSpawnProcess) {
		// Kill first the existing KDLS process
		// before launching a new one.
		killKdlsProcess();
		kdlsProcess = spawnLauncher('--ls', ...kdlsArgs);
	}

	const serverOptions: ServerOptions = connMode == 'tcp'
		? () => connectVlsViaTcp(tcpPort)
		: () => Promise.resolve(kdlsProcess);

	// LSP Client options
	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file', language: 'kd' }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher('**/*.kd')
		},
		outputChannel: kdlsOutputChannel,
		errorHandler: {
			closed() {
				crashCount++;
				if (crashCount < 5) {
					return CloseAction.Restart;
				}
				return CloseAction.DoNotRestart;
			},
			error(err, msg, count) {
				// taken from: https://github.com/golang/vscode-go/blob/HEAD/src/goLanguageServer.ts#L533-L539
				if (count < 5) {
					return ErrorAction.Continue;
				}
				void window.showErrorMessage(
					// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
					`KDLS: Error communicating with the language server: ${err}: ${msg}.`
				);

				return ErrorAction.Shutdown;
			}
		},
	};

	client = new LanguageClient(
		'Kd Language Server',
		serverOptions,
		clientOptions,
		true
	);

	client.onReady()
		.then(() => {
			window.setStatusBarMessage('The Kd language server is ready.', 3000);
		})
		.catch(() => {
			window.setStatusBarMessage('The Kd language server failed to initialize.', 3000);
		});

	// NOTE: the language client was removed in the context subscriptions
	// because of it's error-handling behavior which causes the progress/message
	// box to hang and produce unnecessary errors in the output/devtools log.
	clientDisposable = client.start();
}

export async function activateKdls(): Promise<void> {
	if (!isKdlsEnabled()) return;

	const customKdlsPath = getWorkspaceConfig().get<string>('kdls.customPath');
	if (customKdlsPath && customKdlsPath.trim().length != 0) {
		defaultLauncherArgs.push('--path');
		defaultLauncherArgs.push(customKdlsPath);
	}

	const installed = await checkKdlsInstallation();
	if (installed) {
		connectKdls();
	}
}

export function deactivateKdls(): void {
	if (client) {
		clientDisposable.dispose();
	} else {
		killKdlsProcess();
	}
}

export function killKdlsProcess(): void {
	if (kdlsProcess && !kdlsProcess.killed) {
		log('Terminating existing KDLS process.');
		terminate(kdlsProcess);
	}
}
