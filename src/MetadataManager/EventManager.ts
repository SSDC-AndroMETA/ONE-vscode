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
import * as fs from 'fs';
// import * as path from 'path';
// import {TextEncoder} from 'util';
import * as vscode from 'vscode';

import { Metadata } from './metadataAPI';
import { Balloon } from '../Utils/Balloon';
import { obtainWorkspaceRoot } from '../Utils/Helpers';
import { Logger } from '../Utils/Logger';


// import {ArtifactAttr} from './ArtifactLocator';
// import {OneStorage} from './OneStorage';


/* istanbul ignore next */
export class MetadataEventManager {
  private fileWatcher = vscode.workspace.createFileSystemWatcher(`**/*.{pb,onnx,tflite,circle,cfg,log}`); // glob pattern
  public static didHideExtra: boolean = false;

  public static oldUri: vscode.Uri | undefined = undefined;
  public static newUri: vscode.Uri | undefined = undefined;

  public static register(context: vscode.ExtensionContext) {
    let workspaceRoot: vscode.Uri | undefined = undefined;

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

    // let uri = vscode.Uri.file("/home/pjt01/Workspace/Test_space/a.log") //string to vscode.Uri(type)
    // let path = uri.fsPath; // file:///home/pjt01/Workspace/Test_space/a.log // vscode.Uri(type) to string 
    let registrations = [
      provider.fileWatcher.onDidCreate(async uri => {
        console.log(uri); provider.refresh('Create'); // test code
        // case 1. Contents change event (when uri already in pathToHash)
        // case 2. Baseline event (when create file in file system or copy from external source)
        // case 3. Rename or Move File (processing like case 1 or ignore)
        // case 4. Generate Product from ONE (processing like case 1 or ignore)
        if (uri.fsPath.endsWith('a.log')){
          let path='a.log';
          console.log(1);
          let hash=await Metadata.contentHash(path);
          console.log(hash);
          let content=await Metadata.getMetadata(hash);
          console.log(content);
          content['b.log']="Test";
          await Metadata.setMetadata(hash, content);
        }
      }),
      provider.fileWatcher.onDidChange(uri => {
        console.log(uri); provider.refresh('Change'); // test code
        // case 1. Contents change event only > command event
      }),
      provider.fileWatcher.onDidDelete(uri => { // To Semi Jeong
        console.log(uri); provider.refresh('Delete'); // test code
        // case 1. Delete file (Metadata deactivate or ignore)  > command event
      }),

      vscode.workspace.onDidRenameFiles(uri => {
        provider.refresh('Rename'); //test code

        if(provider.isValidFile(uri['files'][0]['oldUri'].fsPath) && provider.isValidFile(uri['files'][0]['newUri'].fsPath)){
        // case 1. file rename  > command event
          console.log('Yes');
        }
        else if(fs.statSync(uri['files'][0]['newUri'].fsPath).isDirectory()){
        // case 2. Directory check > child(pathToHash) updated & command event
          console.log('Directory');
        }
        else{
        // case 3. ignore
          console.log('No');
        }
      }),
    ];

    registrations.forEach(disposable => context.subscriptions.push(disposable));
  }

  constructor(private workspaceRoot: vscode.Uri | undefined, private _extensionKind: vscode.ExtensionKind) {
  }

  refresh(message: string): void {
    vscode.window.showInformationMessage(message);
  }

  isValidFile(path: string): boolean{
    let ends=['.pb','.onnx','.tflite','.circle','.cfg','.log'];
    return ends.some((x)=>path.endsWith(x));
  }
}