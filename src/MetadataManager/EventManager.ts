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
  private pathToHashObj:any;

  public static didHideExtra: boolean = false;

  public static createUri: vscode.Uri | undefined = undefined;
  public static deleteUri: vscode.Uri | undefined = undefined;

  public static register(context: vscode.ExtensionContext) {
    let workspaceRoot: vscode.Uri | undefined = undefined;
    //let pathToHash=async ()=>{return await PathToHash.getInstance()};


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
    let timerId:NodeJS.Timeout | undefined=undefined;

    let registrations = [
      provider.fileWatcher.onDidChange(async uri => {
        provider.refresh('Change'); // test code
        console.log('onDidChange  '+uri.fsPath);
        if(workspaceRoot){ await provider.changeEvent(workspaceRoot.fsPath, uri.fsPath);}
      }),
      provider.fileWatcher.onDidDelete(async uri => { // To Semi Jeong
        // FIXME: declare PathToHash instance outside of the function (i.e. make instance member variable)
        const instance = await PathToHash.getInstance();
        if (!instance.exists(uri)) return;
        console.log('onDidDelete::', uri); provider.refresh('Delete'); // test code
        const path = uri.path;
        if (MetadataEventManager.createUri) {
          const newUri = MetadataEventManager.createUri;
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
        console.log('onDidCreate  '+uri.fsPath);
        MetadataEventManager.createUri=uri;
        let relPath=vscode.workspace.asRelativePath(uri);
        // case 1. [File] Contents change event (refer to pathToHash)
        // case 2(ignore). [File] Move contents > Processing in Delete
        // case 3(ignore). [Dir]  Move contents > Processing in Delete (reconginition Dir when Dir+File moved)
        // case 4. [File] Copy many files
        // case 5. [Dir]  Copy with files > Serch all the file in the Dir
        // case 4. [File] Generate Product from ONE (processing like case 1 or ignore)
        if(fs.statSync(uri.fsPath).isDirectory()){
          await provider.createDirEvent(uri);
        }
        else if(provider.isValidFile(relPath)){
          if(provider.pathToHashObj.getPathToHash(relPath)&&workspaceRoot){await provider.changeEvent(uri);}
          else{await provider.createFileEvent(uri);}
        }
        
        let temp=await vscode.workspace.findFiles('a.log/**');
        console.log(temp);
        timerId=setTimeout(()=>{MetadataEventManager.createUri=undefined; console.log('test  '+ MetadataEventManager.createUri);},0);
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

  async changeEvent(root: string, path: string): Promise<void> {
    // case 1. [File] Contents change event
    const relativePath = path.split(root+'/')[1];
    const uri = vscode.Uri.file(path);
    console.log(uri);
    console.log(1, relativePath);

    //(1) call contentHas
    const beforehash = await Metadata.getFileHash(uri);
    console.log(2, beforehash);

    // const afterhash=await Metadata.contentHash(path);
    const buffer = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString();
    console.log(3, buffer);
    const afterhash = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log(4, afterhash);

    //(2) deactivate hash frompathToHash
    let metadata = await Metadata.getMetadata(beforehash);
    console.log(5, metadata);
    if(metadata[relativePath]) {  // TODO: change path to filename
        // step 4. If exists, deactivate (set deleted_time) that path.
        // FIXME: Do we need to deactivate it from pathToHash too? > If we deactivate pathToHash, if rename event came, we cannot specify what hash value the path is for.
        metadata[relativePath]["deleted_time"] = new Date();
        console.log(6, metadata);
        // await Metadata.setMetadata(beforehash, metadata);
    }
    metadata = await Metadata.getMetadata(beforehash);
    console.log(7, metadata);

    //(3) change pathToHash
    const instance = await PathToHash.getInstance();
    console.log(instance);
    //instance[relativePath]=afterhash;
    await instance.addPath(uri);
    console.log(8, instance);

    //(4) insert hash from contentHash
    await Metadata.setMetadata(afterhash, {});
    
    console.log(9, await Metadata.getMetadata(afterhash));
    
    const afterMetadata: any = {};
    const filename: any = path.split('/').pop();
    const stats: any = await MetadataEventManager.getStats(afterhash);
    console.log(stats);

    afterMetadata[filename] = {};
    afterMetadata[filename]["name"] = filename.split(".")[0];
    afterMetadata[filename]["file_extension"] = filename.split(".")[1];
    afterMetadata[filename]["create_time"] = stats.birthtime;
    afterMetadata[filename]["modified_time"] = stats.mtime;
    afterMetadata[filename]["deleted_time"] = "삭제 시각(date)";  // TODO: 빈문자열?
    await Metadata.setMetadata(afterhash, afterMetadata);
    
    console.log(11, await Metadata.getMetadata(afterhash));
    //afterMetadata[path]=data;
  }
  public static getStats(hash:any) {
    return new Promise(function (resolve, reject) {
      fs.stat(vscode.Uri.file(obtainWorkspaceRoot()).fsPath + `/.meta/hash_objects/${hash.substring(0, 2)}/${hash.substring(2)}.json`, function (err, stats) {
        if (err) {
          return reject(err);
        }
        return resolve(stats);
      });
    });
  }

  async createDirEvent(uri:vscode.Uri){
    //(1) call search
    let fileList=await vscode.workspace.findFiles('**'+uri.fsPath+'/*.{pb,log,onnx,tflite,circle,cfg}');
    fileList.forEach((uri)=>{
      this.createFileEvent(uri);
    })
  }

  async createFileEvent(uri:vscode.Uri){
    //(1) refer to getPathToHash
    let relPath=vscode.workspace.asRelativePath(uri);
    let newHash=this.pathToHashObj.getPathToHash(relPath);

    if(newHash){ //ubuntu text editor
      this.changeEvent(workspaceRoot.fsPath, uri.fsPath);
      return;
    }

    //(2) insert PathToHash
    await this.pathToHashObj.addPath(uri);
    newHash=this.pathToHashObj.getPathToHash(relPath);

    //(3) Hash로 getMetadata
    let metadata=await Metadata.getMetadata(newHash);

    //(4) Metadata 존재 > Hash로 Metadata Search > 있다면 activate 확인 > (active -> ignore) or (deactivate->activate)
    //(5)                                        > 없다면 유사 파일 존재, copy해서 생성 
    if(Object.keys(metadata).length !== 0){ // metadata exist
      if(metadata[relPath]){
        if (!metadata[relPath]["is_deleted"]) return; // path already activate
        metadata[relPath]["is_deleted"]=false;  // path deactive > activate    
      }
      else{ // for copy format
        const keyList=Object.keys(metadata);
        const keyResult=keyList.filter(key=> !metadata[key]["is_deleted"])// find activate. or last key of KeyList;

        // data copy
        let data=metadata[keyList[0]];
        if(keyResult.length){ data=metadata[keyResult[0]]; }
        else {data["is_deleted"]=false;}

        //update
        const file=fs.statSync(uri.fsPath);
        const splitPath=uri.fsPath.split('.');
        data["file_extension"]=splitPath[splitPath.length-1];
        data["created_time"]=file.ctime.toLocaleString();
        data["modified_time"]=file.mtime.toLocaleString();

        metadata[relPath]=data;
      }
    }
    else{ // metadata doesn't exist : common file        
      const file=fs.statSync(uri.fsPath); 
      const splitPath=uri.fsPath.split('.');
      metadata[relPath]={
        "file_extension": splitPath[splitPath.length-1],
        "created_time": file.ctime.toLocaleString(),
        "modified_time": file.mtime.toLocaleString(),
        "is_deleted": false,
      };
    }
    //(6) Metadata 없음 > 공통 파일만 생성.
    await Metadata.setMetadata(newHash,metadata);
  }
}
