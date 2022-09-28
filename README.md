# Kd language support for Visual Studio Code

Provides [Kd language](https://kd-lang.github.io) support for Visual Studio Code.

## Features

### Code Editing

- syntax highlighting
- code snippets for quick coding

## Usage

First you will need to install [Visual Studio Code][vs-code] >= `1.40`.
In the command palette (`Cmd+Shift+P`) select `Install Extensions` and choose `Kd`.
Alternatively you can install the extension from the [Marketplace][market-ext-link].
Now open any `.kd`, `.dsh`, `.dd` file in VS Code.

_Note_: It is recommended to turn `Auto Save` on
    in Visual Studio Code (`File -> Auto Save`) when using this extension.

## Commands

- `Kd: Run current file`
- `Kd: Format current file`
- `Kd: Build an optimized executable from current file`
- `Kd: Show Kd version`
- `Kd: Update KDLS`
- `Kd: Restart KDLS`

You can access all of the above commands from the command palette (`Cmd+Shift+P`).

## License

[MIT](./LICENSE)

<!-- Links -->
[vs-code]: https://code.visualstudio.com/
[market-ext-link]: https://marketplace.visualstudio.com/items?itemName=kdlanguage.vscode-kdlang
