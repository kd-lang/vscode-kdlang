import { window, Terminal, Disposable } from 'vscode';
import { getKdExecCommand, getCwd } from './utils';
import cp, { ExecException, execFile } from 'child_process';

type ExecCallback = (error: ExecException | null, stdout: string, stderr: string) => void;

let kdRunTerm: Terminal = null;

export function execKdInTerminal(args: string[]): void {
	const kdexec = getKdExecCommand();
	const cmd = `${kdexec} ${args.join(' ')}`;

	if (!kdRunTerm) kdRunTerm = window.createTerminal('KD');

	kdRunTerm.show();
	kdRunTerm.sendText(cmd);
}

export function execKdInTerminalOnBG(args: string[]): void {
	const kdexec = getKdExecCommand();
	const cmd = `${kdexec} ${args.join(' ')}`;

	cp.exec(cmd);
}

export function execKd(args: string[], callback: ExecCallback): void {
	const kdexec = getKdExecCommand();
	const cwd = getCwd();

	// console.log(`Executing ${kdexec} ${args.join(" ")} on ${cwd}`);
	execFile(kdexec, args, { cwd }, (err, stdout, stderr) => {
		callback(err, stdout, stderr);
	});
}

export function attachOnCloseTerminalListener(): Disposable {
	return window.onDidCloseTerminal((term) => {
		if (term.name == 'KD') kdRunTerm = null;
	});
}
