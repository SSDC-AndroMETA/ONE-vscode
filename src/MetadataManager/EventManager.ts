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
  private fileWatcher = vscode.workspace.createFileSystemWatcher(`**/*`); // glob pattern
  public static didHideExtra: boolean = false;

  public static oldUri: vscode.Uri | undefined = undefined;
  public static newUri: vscode.Uri | undefined = undefined;

  public static createUri: vscode.Uri | undefined;
  public static deleteUri: vscode.Uri | undefined = undefined;

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
    let timerId:NodeJS.Timeout | undefined=undefined;
    let registrations = [
      provider.fileWatcher.onDidCreate(async uri => {
        provider.refresh('Create'); // test code
        console.log('onDidCreate  '+uri.fsPath);
        MetadataEventManager.createUri=uri;
        //if dir
        // [case 5] > (1) call search > listup files > while [case4]
        //else files
        // validcheck(endswith)
        // pathToHash search [case 1] > (1) call contentHash (2) change pathToHash (3) deactivate hash from pathToHash (4) insert hash from contentHash
        // [case 4] > (1) call contentHash (2) getMetadata (3) compare to path(activate?) > Yes(ignore), No(Setup)
        let temp=await vscode.workspace.findFiles('a.log/**');
        console.log(temp);
        timerId=setTimeout(()=>{MetadataEventManager.createUri=undefined; console.log('test  '+ MetadataEventManager.createUri);},0);
        ////// case 1. [File] Contents change event (refer to pathToHash)
        ////// case 2(ignore). [File] Move contents > Processing in Delete
        ////// case 3(ignore). [Dir]  Move contents > Processing in Delete (reconginition Dir when Dir+File moved)
        // case 4. [File] Copy many files
        // case 5. [Dir]  Copy with files > Serch all the file in the Dir
        // *if already exist, ignore the creation events.
        // *always new path.
        // *
        // case 4. [File] Generate Product from ONE (processing like case 1 or ignore)
      }),
      provider.fileWatcher.onDidChange(uri => {
        console.log(uri); provider.refresh('Change'); // test code
        // case 1. Contents change event only > command event
      }),
      provider.fileWatcher.onDidDelete(async uri => { // To Semi Jeong
        console.log('onDidDelete::', uri); provider.refresh('Delete'); // test code
        // TODO: pathToHash update
        // 만약 필요하다면 pathToHash에도 folder용 update, file용 update 만들어서 따로 처리 (2번 돌아서 비효율적)
        // 아니면 그냥 현재 disableMetadata, moveMetadata(file용 함수)에서만 처리하기
        // file: 일반 삭제 > 그냥 지우기, 이동/rename > path 이름 변경
        const path = uri.path;
        if (MetadataEventManager.createUri) {
          const newUri = MetadataEventManager.createUri.path;
          // The file/folder is moved/renamed
          if (fs.statSync(newUri).isDirectory()) {
            // case 4. [Dir]+Path       | move > search (delete & new)
            Metadata.moveMetadataUnderFolder(path, newUri);
          } else if (provider.isValidFile(path)) { // FIXME: Do we have to check isValidFile for newUri too?
            // case 3. [File]+Path      | move (delete & new)
            Metadata.moveMetadata(path, newUri);
          }
        } else {
          if (Metadata.d_isDir(path)) {
            // case 2. [Dir]+undefined  | deactive > search
            Metadata.disableMetadataUnderFolder(path);
          } else if (provider.isValidFile(path)) {
            // case 1. [File]+undefined | deactive
            Metadata.disableMetadata(uri);
          }
        }
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
      })
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