/*
 * Copyright (c) 2022 Samsung Electronics Co., Ltd. All Rights Reserved
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// import * as assert from 'assert';
// import * as fs from 'fs';
// import * as path from 'path';
// import {TextEncoder} from 'util';
import * as vscode from 'vscode';

// import {CfgEditorPanel} from '../CfgEditor/CfgEditorPanel';
import {Balloon} from '../Utils/Balloon';
import {obtainWorkspaceRoot} from '../Utils/Helpers';
import {Logger} from '../Utils/Logger';

// import {ArtifactAttr} from './ArtifactLocator';
// import {OneStorage} from './OneStorage';


/* istanbul ignore next */
export class MetadataEventManager {
  private fileWatcher = vscode.workspace.createFileSystemWatcher(`**/*`);
  public static didHideExtra: boolean = false;

  public static register(context: vscode.ExtensionContext) {
    let workspaceRoot: vscode.Uri|undefined = undefined;
    // workspace error handling
    try {
      workspaceRoot = vscode.Uri.file(obtainWorkspaceRoot());
      Logger.info('OneExplorer', `workspace: ${workspaceRoot.fsPath}`);
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.message === 'Need workspace') {
          Logger.info('OneExplorer', e.message);
        } else {
          Logger.error('OneExplorer', e.message);
          Balloon.error('Something goes wrong while setting workspace.', true);
        }
      } else {
        Logger.error('OneExplorer', 'Unknown error has been thrown.');
      }
    }

    const provider = new MetadataEventManager(workspaceRoot, context.extension.extensionKind);

    let registrations = [
      provider.fileWatcher.onDidCreate(() => provider.refresh('Yes')),
      provider.fileWatcher.onDidChange(() => provider.refresh('Uhm...')),
      provider.fileWatcher.onDidDelete(() => provider.refresh('No')),
    ];

    if (provider.isLocal) {
    } else {
      vscode.commands.executeCommand('setContext', 'one:extensionKind', 'Workspace');
    }

    registrations.forEach(disposable => context.subscriptions.push(disposable));
  }

  constructor(private workspaceRoot: vscode.Uri|undefined, private _extensionKind: vscode.ExtensionKind) {
    vscode.commands.executeCommand(
        'setContext', 'one.explorer:didHideExtra', MetadataEventManager.didHideExtra);
  }

  get isLocal(): boolean {
    return (this._extensionKind === vscode.ExtensionKind.UI);
  }

  refresh(message:string): void {
    vscode.window.showInformationMessage(message);
  }
}
