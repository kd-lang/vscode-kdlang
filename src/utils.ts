import {
	TextDocument,
	workspace,
	WorkspaceConfiguration,
	window,
	Uri,
	WorkspaceFolder,
} from 'vscode';
import { platform } from 'os';
import { execFileSync } from 'child_process';

const defaultCommand = 'kd';

/** Get Kd executable command.
 * Will get from user setting configuration first.
 * If user don't specify it, then get default command
 */
export function getKdExecCommand(): string {
	const config = getWorkspaceConfig();
	const kdPath = config.get('pathToExecutableFile', '') || defaultCommand;
	return kdPath;
}

/** Get Kd configuration. */
export function getWorkspaceConfig(): WorkspaceConfiguration {
	const currentWorkspaceFolder = getWorkspaceFolder();
	return workspace.getConfiguration('kd', currentWorkspaceFolder.uri);
}

/** Get current working directory.
 * @param uri The URI of document
 */
export function getCwd(uri?: Uri): string {
	const folder = getWorkspaceFolder(uri || null);
	return folder.uri.fsPath;
}

/** Get workspace of current document.
 * @param uri The URI of document
 */
export function getWorkspaceFolder(uri?: Uri): WorkspaceFolder {
	if (uri) return workspace.getWorkspaceFolder(uri);
	const currentDoc = getCurrentDocument();
	return currentDoc
		? workspace.getWorkspaceFolder(currentDoc.uri)
		: workspace.workspaceFolders[0];
}

export function getCurrentDocument(): TextDocument {
	return window.activeTextEditor ? window.activeTextEditor.document : null;
}

export function openUrl(url: string): void {
	const os = platform();
	const open = {
		win32: 'start',
		linux: 'xdg-open',
		darwin: 'open',
	};
	execFileSync(open[os], [url]);
}
