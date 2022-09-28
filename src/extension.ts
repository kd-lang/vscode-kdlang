import vscode, { workspace, ExtensionContext, ConfigurationChangeEvent } from 'vscode';
import * as commands from './commands';
import { activateKdls, deactivateKdls, isKdlsEnabled } from './langserver';

const cmds = {
	'kd.run': commands.run,
	'kd.fmt': commands.fmt,
	'kd.ver': commands.ver,
	'kd.prod': commands.prod,
	'kd.kdls.update': commands.updateKdls,
	'kd.kdls.restart': commands.restartKdls,
};

/**
 * This method is called when the extension is activated.
 * @param context The extension context
 */
export function activate(context: ExtensionContext): void {
	for (const cmd in cmds) {
		const handler = cmds[cmd] as () => void;
		const disposable = vscode.commands.registerCommand(cmd, handler);
		context.subscriptions.push(disposable);
	}

	workspace.onDidChangeConfiguration((e: ConfigurationChangeEvent) => {
		if (e.affectsConfiguration('kd.kdls.enable')) {
			if (isKdlsEnabled()) {
				void activateKdls();
			} else {
				deactivateKdls();
			}
		} else if (e.affectsConfiguration('kd.kdls') && isKdlsEnabled()) {
			void vscode.window.showInformationMessage('KDLS: Restart is required for changes to take effect. Would you like to proceed?', 'Yes', 'No')
				.then(selected => {
					if (selected == 'Yes') {
						void vscode.commands.executeCommand('kd.kdls.restart');
					}
				});
		}
	});

	const shouldEnableVls = isKdlsEnabled();
	if (shouldEnableVls) {
		void activateKdls();
	}
}

export function deactivate(): void {
	if (isKdlsEnabled()) {
		deactivateKdls();
	}
}
