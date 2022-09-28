import { window, ProgressLocation } from 'vscode';
import { execKdInTerminal, execKdInTerminalOnBG, execKd } from './exec';
import { activateKdls, deactivateKdls, installKdls } from './langserver';
import { log, outputChannel, kdlsOutputChannel } from './status';

/** Run current file. */
export async function run(): Promise<void> {
	const document = window.activeTextEditor.document;
	await document.save();
	const filePath = `"${document.fileName}"`;

	execKdInTerminal(['run', filePath]);
}

/** Format current file. */
export async function fmt(): Promise<void> {
	const document = window.activeTextEditor.document;
	await document.save();
	const filePath = `"${document.fileName}"`;

	execKdInTerminalOnBG(['fmt', '-w', filePath]);
}

/** Build an optimized executable from current file. */
export async function prod(): Promise<void> {
	const document = window.activeTextEditor.document;
	await document.save();
	const filePath = `"${document.fileName}"`;

	execKdInTerminal(['-prod', filePath]);
}

/** Show version info. */
export function ver(): void {
	execKd(['-version'], (err, stdout) => {
		if (err) {
			void window.showErrorMessage(
				'Unable to get the version number. Is Kd installed correctly?'
			);
			return;
		}
		void window.showInformationMessage(stdout);
	});
}

export function updateKdls(): void {
	void installKdls(true);
}

export function restartKdls(): void {
	window.withProgress({
		location: ProgressLocation.Notification,
		cancellable: false,
		title: 'KDLS'
	}, async (progress) => {
		progress.report({ message: 'Restarting' });
		deactivateKdls();
		kdlsOutputChannel.clear();
		await activateKdls();
	}).then(
		() => {
			return;
		},
		(err) => {
			log(err);
			outputChannel.show();
			void window.showErrorMessage(
				'Failed restarting KDLS. See output for more information.'
			);
		}
	);
}
