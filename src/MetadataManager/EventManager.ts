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

    // let timerId: NodeJS.Timeout | undefined=undefined;

    // let uri = vscode.Uri.file("/home/pjt01/Workspace/Test_space/a.log") //string to vscode.Uri(type)
    // let path = uri.fsPath; // file:///home/pjt01/Workspace/Test_space/a.log // vscode.Uri(type) to string 
          // provider.fileWatcher.onDidCreate(async uri => {
      //   console.log(uri); provider.refresh('Create'); // test code
      //   // case 1. Contents change event (when uri already in pathToHash)
      //   // case 2. Baseline event (when create file in file system or copy from external source)
      //   // case 3. Rename or Move File (processing like case 1 or ignore)
      //   // case 4. Generate Product from ONE (processing like case 1 or ignore)
      //   if (uri.fsPath.endsWith('a.log')){
      //     let path='a.log';
      //     console.log(1);
      //     let hash=await Metadata.contentHash(path);
      //     console.log(hash);
      //     let content=await Metadata.getMetadata(hash);
      //     console.log(content);
      //     content['b.log']="Test";
      //     await Metadata.setMetadata(hash, content);
      //   }
      // }),
      // vscode.workspace.onDidRenameFiles(uri => {
      //   provider.refresh('Rename'); //test code

      //   if(provider.isValidFile(uri['files'][0]['oldUri'].fsPath) && provider.isValidFile(uri['files'][0]['newUri'].fsPath)){
      //   // case 1. file rename  > command event
      //     console.log('Yes Rename');
      //   }
      //   else if(fs.statSync(uri['files'][0]['newUri'].fsPath).isDirectory()){
      //   // case 2. Directory check > child(pathToHash) updated & command event
      //     console.log('Directory  Rename');
      //   }
      //   else{
      //   // case 3. ignore
      //     console.log('No  Rename');
      //   }
      // }),
    let timerId:NodeJS.Timeout | undefined=undefined;
    let registrations = [
      provider.fileWatcher.onDidChange(async uri => {
        provider.refresh('Change'); // test code
        console.log('onDidChange  '+uri.fsPath);
        let relPath=vscode.workspace.asRelativePath(uri);
        if(workspaceRoot){ await provider.changeEvent(uri);}
      }),
      provider.fileWatcher.onDidDelete(async uri => { // To Semi Jeong
        console.log('onDidDelete::', uri); provider.refresh('Delete'); // test code
        // TODO: pathToHash update
        // 만약 필요하다면 pathToHash에도 folder용 update, file용 update 만들어서 따로 처리 (2번 돌아서 비효율적)
        // 아니면 그냥 현재 disableMetadata, moveMetadata(file용 함수)에서만 처리하기
        // file: 일반 삭제 > 그냥 지우기, 이동/rename > path 이름 변경
        // const path = uri.path;
        // if (MetadataEventManager.createUri) {
        //   const newUri = MetadataEventManager.createUri.path;
        //   // The file/folder is moved/renamed
        //   if (fs.statSync(newUri).isDirectory()) {
        //     // case 4. [Dir]+Path       | move > search (delete & new)
        //     Metadata.moveMetadataUnderFolder(path, newUri);
        //   } else if (provider.isValidFile(path)) { // FIXME: Do we have to check isValidFile for newUri too?
        //     // case 3. [File]+Path      | move (delete & new)
        //     Metadata.moveMetadata(path, newUri);
        //   }
        // } else {
        //   if (Metadata.d_isDir(path)) {
        //     // case 2. [Dir]+undefined  | deactive > search
        //     Metadata.disableMetadataUnderFolder(path);
        //   } else if (provider.isValidFile(path)) {
        //     // case 1. [File]+undefined | deactive
        //     Metadata.disableMetadata(uri);
        //   }
        // }
      }),
      provider.fileWatcher.onDidCreate(async uri => {
        provider.refresh('Create'); // test code
        console.log('onDidCreate  '+uri.fsPath);
        MetadataEventManager.createUri=uri;
        let relPath=vscode.workspace.asRelativePath(uri);
        if(fs.statSync(uri.fsPath).isDirectory()){
          await provider.createDirEvent(uri);
        }
        else if(provider.isValidFile(relPath)){
          if(provider.pathToHashObj.getPathToHash(relPath)&&workspaceRoot){await provider.changeEvent(uri);}
          else{await provider.createFileEvent(uri);}
        }
        

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
    ];

    registrations.forEach(disposable => context.subscriptions.push(disposable));
  }

  constructor(private workspaceRoot: vscode.Uri | undefined, private _extensionKind: vscode.ExtensionKind) {
    PathToHash.getInstance().then(data=>{this.pathToHashObj=data});
  }

  refresh(message: string): void {
    vscode.window.showInformationMessage(message);
  }

  isValidFile(path: string): boolean{
    let ends=['.pb','.onnx','.tflite','.circle','.cfg','.log'];
    return ends.some((x)=>path.endsWith(x));
  }

  async changeEvent(uri:vscode.Uri){
  }

  async createDirEvent(uri:vscode.Uri){
    //(1) call search
    let fileList=await vscode.workspace.findFiles('**'+uri.fsPath+'/*.{pb,log,onnx,tflite,circle,cfg}');
    // console.log("file_list");
    // console.log(fileList);
    fileList.forEach((uri)=>{
      this.createFileEvent(uri);
    })
  }

  async createFileEvent(uri:vscode.Uri){
    //(1) refer to getPathToHash
    let relPath=vscode.workspace.asRelativePath(uri);
    let newHash=this.pathToHashObj.getPathToHash(relPath);

    if(newHash){ //ubuntu text editor
      this.changeEvent(uri);
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