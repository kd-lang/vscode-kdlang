import { window } from 'vscode';

export const outputChannel = window.createOutputChannel('KD');
export const kdlsOutputChannel = window.createOutputChannel('Kd Language Server');

export function log(msg: string): void {
    // logging for devtools/debug
    console.log(`[vscode-kdlang] ${msg}`);
    outputChannel.appendLine(msg);
}
