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
import { PathToHash } from './pathToHash';

import * as crypto from 'crypto';
// import {ArtifactAttr} from './ArtifactLocator';
// import {OneStorage} from './OneStorage';



/* istanbul ignore next */
export class MetadataEventManager {
  private fileWatcher = vscode.workspace.createFileSystemWatcher(`**/*`); // glob pattern
  private mutexLock:any;

  public static didHideExtra: boolean = false;

  public static createUri: vscode.Uri | undefined = undefined;
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

    const provider = new MetadataEventManager();

    let registrations = [
      provider.fileWatcher.onDidChange(async uri => {
        provider.refresh('Change'); // test code
        if(workspaceRoot){ await provider.changeEvent(uri);}
      }),
      provider.fileWatcher.onDidDelete(async uri => { // To Semi Jeong
        // FIXME: declare PathToHash instance outside of the function (i.e. make instance member variable)
        const instance = await PathToHash.getInstance();
        if (!instance.exists(uri)) {{return;}}
        // const path = uri.path;
        if (MetadataEventManager.createUri) {
          const newUri = MetadataEventManager.createUri;
          MetadataEventManager.createUri=undefined;       

          // The file/folder is moved/renamed
          if (fs.statSync(newUri.path).isDirectory()) {
            // case 4. [Dir]+Path       | move > search (delete & new)
            await Metadata.moveMetadataUnderFolder(uri, newUri);
          } else {
            // case 3. [File]+Path      | move (delete & new)
            await Metadata.moveMetadata(uri, newUri);
          }
        } else {
          const pathToHash = await PathToHash.getInstance();
          if (!pathToHash.isFile(uri)) {
            // case 2. [Dir]+undefined  | deactive > search
            await Metadata.disableMetadataUnderFolder(uri);
          } else {
            // case 1. [File]+undefined | deactive
            await Metadata.disableMetadata(uri);
          }
        }
      }),
      provider.fileWatcher.onDidCreate(async uri => {
        provider.refresh('Create'); // test code
        MetadataEventManager.createUri=uri;

        const instance= await PathToHash.getInstance();
        if(fs.statSync(uri.fsPath).isDirectory()){
          // case 1. [Dir]  Copy with files > Serch all the file in the Dir
          await provider.createDirEvent(uri);
        }
        else if(Metadata.isValidFile(uri)){
          if(instance.get(uri)&&workspaceRoot){
            //case 2. [File] Contents change event in Ubuntu terminal (refer to pathToHash)
            await provider.changeEvent(uri);
          }
        else{
          // case 3. [File] File generation event
          await provider.createFileEvent(uri);
        }
        }
        MetadataEventManager.createUri=undefined;       

      }),
    ];

    registrations.forEach(disposable => context.subscriptions.push(disposable));
  }

  constructor() {
  }

  refresh(message: string): void {
    vscode.window.showInformationMessage(message);
  }


  async changeEvent(uri:vscode.Uri): Promise<void> {
    if(!Metadata.isValidFile(uri)) {return;}
    // case 1. [File] Contents change event
    const relativePath = vscode.workspace.asRelativePath(uri);

    //(1) get beforehash and set afterhash
    const beforehash: string = await Metadata.getFileHash(uri);
    const buffer = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString();
    const afterhash: string = crypto.createHash('sha256').update(buffer).digest('hex');

    //(2) deactivate changed hash object
    let metadata: any = await Metadata.getMetadata(beforehash);
    if(Object.keys(metadata).length !== 0 && metadata[relativePath]) {
        metadata[relativePath]["is-deleted"] = true;
        await Metadata.setMetadata(beforehash, metadata);
    }

    //(3) change pathToHash
    const instance = await PathToHash.getInstance();
    await instance.addPath(uri);

    metadata = await Metadata.getMetadata(afterhash);

    //(4) create new hash object
    if (Object.keys(metadata).length === 0) {
      await Metadata.setMetadata(afterhash, {});
    }
    
    metadata = await MetadataEventManager.createDefaultMetadata(uri, metadata);

    await Metadata.setMetadata(afterhash, metadata);    
  }

  public static async createDefaultMetadata(uri:vscode.Uri, metadata: any){

    const relativePath = vscode.workspace.asRelativePath(uri);
    const filename: any = relativePath.split('/').pop();
    const stats: any = await Metadata.getStats(uri);

    metadata[relativePath] = {};
    metadata[relativePath]["name"] = filename;

    metadata[relativePath]["file-extension"] = filename.split(".").at(-1);
    metadata[relativePath]["createTime"] = stats.birthtime;
    metadata[relativePath]["modified-time"] = stats.mtime;
    metadata[relativePath]["is-deleted"] = false;

    return metadata;
  }

  async createDirEvent(uri:vscode.Uri){
    //(1) call search
    let fileList=await vscode.workspace.findFiles('**'+uri.fsPath+'/*.{pb,log,onnx,tflite,circle,cfg}');
    fileList.forEach((uri)=>{
      this.createFileEvent(uri);
    });
  }

  async createFileEvent(uri:vscode.Uri){
    //(1) refer to get
    let relPath=vscode.workspace.asRelativePath(uri);
    const instance=await PathToHash.getInstance();

    //(2) insert PathToHash
    await instance.addPath(uri);
    let newHash=await instance.get(uri);

    //(3) Hash로 getMetadata
    let metadata=await Metadata.getMetadata(newHash);
    //(4) Metadata Exist (searching with Hash)? (activate | deactivate) : copy format 
    if(Object.keys(metadata).length !== 0){ // metadata exist
      if(metadata[relPath]){

        if (!metadata[relPath]["is-deleted"]) {return;} // path already activate. ignore this case
        metadata[relPath]["is-deleted"]=false;  // path deactive > activate    
      }
      else{ // for copy format
        const keyList=Object.keys(metadata);
        const keyResult=keyList.filter(key=> !metadata[key]["is-deleted"]); // find activate. or last key of KeyList;

        //data copy

        let data=metadata[keyList[keyList.length-1]];
        if(keyResult.length){ data=metadata[keyResult[0]]; }
        else {data["is-deleted"]=false;}


        //data update
        const stats: any = await Metadata.getStats(uri);
        data["name"]=uri.fsPath.split('/').pop();
        data["file-extension"]=uri.fsPath.split('.').pop();
        data["created-time"]=stats.birthtime;
        data["modified-time"]=stats.mtime;

        metadata[relPath]=data;
      }
    }
    else{ // metadata doesn't exist : common file        
      // const splitPath=uri.fsPath.split('.');
      const stats: any = await Metadata.getStats(uri);

      metadata[relPath]={
        "name":uri.fsPath.split('/').pop(),
        "file-extension": uri.fsPath.split('.').pop(),
        "created-time": stats.birthtime,
        "modified-time": stats.mtime,
        "is-deleted": false,
      };
    }
    //(6) Metadata Generation
    await Metadata.setMetadata(newHash,metadata);
    // Todo. [File] Generate Product from ONE (processing like case 1 or ignore)
  }
}