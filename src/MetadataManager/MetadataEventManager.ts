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
import * as fs from 'fs';
import * as vscode from 'vscode';

import {Balloon} from '../Utils/Balloon';
import {obtainWorkspaceRoot} from '../Utils/Helpers';
import {Logger} from '../Utils/Logger';

import {BuildInfo, Metadata} from './Metadata';
import {PathToHash} from './PathToHash';
import {Relation} from './Relation';
import {isValidFile} from './utils';

class MetadataEventQueue {
  private inProgress: boolean = false;
  private queue: {method: Function, input: {[key: string]: any}}[] = [];

  constructor() {
    this.queue = [];
  }

  enqueue(method: any, input: {[key: string]: any}): void {
    this.queue.push({method: method, input: input});
    this.autoAction();
  }

  front() {
    return this.queue[0];
  }
  dequeue() {
    this.queue.shift();
  }

  clear() {
    this.inProgress = false;
    this.queue = [];
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  autoAction() {
    if (this.inProgress === false) {
      this.inProgress = true;
      this.action();
    }
  }

  async action() {
    await this.front().method();

    this.dequeue();

    if (this.isEmpty()) {
      this.clear();
    } else {
      this.action();
    }
  }
}

class MetadataEventBuffer {
  private _queue = new MetadataEventQueue();
  constructor() {}
  public setEvent(request: any, input: {[key: string]: any}) {
    this._queue.enqueue(() => {
      return new Promise(() => {
        if (Object.keys(input).length === 0) {
          request();
        } else {
          request(input);
        }
      });
    }, input);
  }
}


/* istanbul ignore next */
export class MetadataEventManager {
  private fileWatcher = vscode.workspace.createFileSystemWatcher(`**/*`);  // glob pattern
  private eventBuffer = new MetadataEventBuffer();
  private pathToHash: PathToHash|undefined = undefined;
  private didCreateUri: vscode.Uri|undefined = undefined;

  /**
   * Communicates among events
   * didCreateUri : communicates created file uri to delete event when file is renamed/moved.
   */

  public static register(context: vscode.ExtensionContext) {
    let workspaceRoot: vscode.Uri|undefined = undefined;

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

    const manager = new MetadataEventManager();

    let registrations = [
      manager.fileWatcher.onDidChange(async uri => {
        if (!manager.pathToHash) {
          manager.pathToHash = await PathToHash.getInstance();
        }
        const caseFlag = manager.pathToHash.get(uri);
        if (!caseFlag) {
          Logger.info('Metadata Manager', 'Unsupervised directory/file have been changed');
          return;
        }
        manager.eventBuffer.setEvent(manager.changeFileEvent, {'uri': uri});
      }),
      manager.fileWatcher.onDidDelete(async uri => {
        const toUri = manager.didCreateUri;
        if (!manager.pathToHash) {
          manager.pathToHash = await PathToHash.getInstance();
        }
        const caseFlag = manager.pathToHash.get(uri);
        if (!caseFlag) {
          if (toUri) {
            Logger.info('Metadata Manager', 'Unsupervised directory/file have been renamed/moved');
          } else {
            Logger.info('Metadata Manager', 'Unsupervised directory/file have been removed');
          }
          return;
        }

        if (toUri) {
          manager.didCreateUri = undefined;
          // The file/folder is moved/renamed
          if (typeof (caseFlag) === 'string') {
            // case 1. [File]+Path      | move (delete & new)
            manager.eventBuffer.setEvent(manager.moveFileEvent, {'fromUri': uri, 'toUri': toUri});
          } else {
            // case 2. [Dir]+Path       | move > search (delete & new)
            manager.eventBuffer.setEvent(manager.moveDirEvent, {'fromUri': uri, 'toUri': toUri});
          }
        } else {
          if (typeof (caseFlag) === 'string') {
            // case 3. [File]+undefined | deactive
            manager.eventBuffer.setEvent(manager.deleteFileEvent, {'uri': uri});
          } else {
            // case 4. [Dir]+undefined  | deactive > search
            manager.eventBuffer.setEvent(manager.deleteDirEvent, {'uri': uri});
          }
        }
      }),
      manager.fileWatcher.onDidCreate(async uri => {
        manager.didCreateUri = uri;
        if (!manager.pathToHash) {
          manager.pathToHash = await PathToHash.getInstance();
        }

        const caseFlag = manager.pathToHash.get(uri);
        if (fs.statSync(uri.fsPath).isDirectory()) {
          // case 1. [Dir]  Copy with files > Serch all the file in the Dir
          manager.eventBuffer.setEvent(manager.createDirEvent, {'uri': uri});
        } else if (isValidFile(uri)) {
          if (caseFlag) {
            // case 2. [File] Contents change event in Ubuntu terminal (already file exists but call
            // create event)
            manager.eventBuffer.setEvent(manager.changeFileEvent, {'uri': uri});
          } else {
            // case 3. [File] File generation event
            manager.eventBuffer.setEvent(manager.createFileEvent, {'uri': uri});
          }
        } else {
          Logger.info('Metadata Manager', 'Unsupervised directory/file have been created');
          return;
        }
        manager.eventBuffer.setEvent(manager.resetDidCreateUri, {});
      }),
    ];

    registrations.forEach(disposable => context.subscriptions.push(disposable));
  }

  async resetDidCreateUri() {
    this.didCreateUri = undefined;
  }

  async changeFileEvent(input: {[key: string]: any}) {
    // TO BE IMPLEMENTED
    const uri = input['uri'];
    const relPath = vscode.workspace.asRelativePath(uri);

    if (this.pathToHash) {
      // case 1. [File] Contents change event
      //(1) get beforehash and set afterhash
      const fromHash: string = this.pathToHash.get(uri);

      //(2) deactivate changed hash object
      await Metadata.disable(uri, fromHash);

      //(3) change pathToHash
      await this.pathToHash.add(uri);
      const toHash: string = this.pathToHash.get(uri);

      //(4) get metaObj from hash
      let metaObj = await Metadata.getObj(toHash);

      //(5) Metadata copy : metaObj exists, metaEntry doesn't exist
      if (Object.keys(metaObj).length !== 0 && !metaObj[relPath]) {
        const keyList = Object.keys(metaObj);
        const keyResult = keyList.filter(
            key => !metaObj[key]['is-deleted']);  // find activate or last key of KeyList;

        // data deep copy
        let metaEntry = JSON.parse(JSON.stringify(metaObj[keyList[keyList.length - 1]]));
        if (keyResult.length !== 0) {
          metaEntry = JSON.parse(JSON.stringify(metaObj[keyResult[0]]));
        }

        metaObj[relPath] = metaEntry;
        Metadata.setObj(toHash, metaObj);
      }

      //(6) create or update new hash object
      await Metadata.createDefault(uri, toHash);

      let metaEntry = await Metadata.getEntry(uri, toHash);
      metaEntry = BuildInfo.get(metaEntry, uri);
      await Relation.updateFile(uri);
      await Metadata.setEntry(uri, toHash, metaEntry);
    }
  }

  async createDirEvent(input: {[key: string]: any}) {
    const uri = input['uri'];

    //(1) call search
    let uriList = await vscode.workspace.findFiles('**' + uri.fsPath + '/*');
    for (let uri of uriList) {
      if (isValidFile(uri)) {
        this.createFileEvent({'uri': uri});
      }
    }
  }

  async createFileEvent(input: {[key: string]: any}) {
    const uri = input['uri'];
    const relPath = vscode.workspace.asRelativePath(uri);

    if (this.pathToHash) {
      //(1) insert PathToHash
      await this.pathToHash.add(uri);
      const hash: string = this.pathToHash.get(uri);

      //(2) get metaObj from hash
      let metaObj = await Metadata.getObj(hash);

      //(3) Metadata copy : metaObj exists, metaEntry doesn't exist
      if (Object.keys(metaObj).length !== 0 && !metaObj[relPath]) {
        const keyList = Object.keys(metaObj);
        const keyResult = keyList.filter(
            key => !metaObj[key]['is-deleted']);  // find activate or last key of KeyList;

        // data deep copy
        let metaEntry = JSON.parse(JSON.stringify(metaObj[keyList[keyList.length - 1]]));
        if (keyResult.length !== 0) {
          metaEntry = JSON.parse(JSON.stringify(metaObj[keyResult[0]]));
        }

        metaObj[relPath] = metaEntry;
        Metadata.setObj(hash, metaObj);
      }

      //(6) create or update new hash object
      await Metadata.createDefault(uri, hash);

      let metaEntry = await Metadata.getEntry(uri, hash);
      metaEntry = BuildInfo.get(metaEntry, uri);
      await Relation.updateFile(uri);
      await Metadata.setEntry(uri, hash, metaEntry);
    }
  }

  async deleteDirEvent(input: {[key: string]: any}) {
    const uri = input['uri'];

    // if it is a folder, deactivate all of its child files
    if (this.pathToHash) {
      for (let f of this.pathToHash.getFilesUnderFolder(uri)) {
        if (typeof (this.pathToHash.get(uri)) !== 'string') {
          await this.deleteDirEvent({'uri': f});
        } else if (isValidFile(f)) {
          await this.deleteFileEvent({'uri': f});
        }
      }
    }
  }

  async deleteFileEvent(input: {[key: string]: any}) {
    const uri = input['uri'];

    if (!isValidFile(uri)) {
      return;
    }

    if (this.pathToHash) {
      // step 1. Get hash value from pathToHash
      const hash = this.pathToHash.get(uri);
      if (hash === undefined) {
        return;
      }

      // step 2. deactivate (set 'is_deleted') that path.
      await Metadata.disable(uri, hash);

      // step 3. Update pathToHash
      this.pathToHash.delete(uri);
    }
  }

  async moveDirEvent(input: {[key: string]: any}) {
    const fromDirUri = input['fromUri'];
    const toDirUri = input['toUri'];

    if (this.pathToHash) {
      const uriList = await vscode.workspace.findFiles('**' + toDirUri.fsPath + '/*');

      for (let toUri of uriList) {
        if (isValidFile(toUri)) {
          const fromUri = vscode.Uri.joinPath(
              fromDirUri,
              toUri.fsPath.substring(toUri.path.lastIndexOf(toDirUri.path) + toUri.path.length));
          await this.moveFileEvent({'fromUri': fromUri, 'toUri': toUri});
        }
      }
    }
  }
  async moveFileEvent(input: {[key: string]: any}) {
    const fromUri = input['fromUri'];
    const toUri = input['toUri'];

    const fromRelPath = vscode.workspace.asRelativePath(fromUri);

    if (this.pathToHash) {
      if (isValidFile(fromUri) && !isValidFile(toUri)) {
        // when the file is renamed from a valid file name to a invalid file name
        // ex. a.log > a.txt
        await this.deleteFileEvent(fromUri);
      } else if (!isValidFile(fromUri) || !isValidFile(toUri)) {
        return;
      }

      // 1. Get hash from pathToHash
      const fromHash = this.pathToHash.get(fromUri);
      if (fromHash === undefined) {
        return;
      }

      // 2. Update pathToHash
      this.pathToHash.delete(fromUri);
      await this.pathToHash.add(toUri);
      const toHash = this.pathToHash.get(toUri);

      // 3. Get metadata from the old path
      const fromMetaEntry = await Metadata.getEntry(fromUri, fromHash);
      if (fromMetaEntry && Object.keys(fromMetaEntry[fromRelPath]).length !== 0) {
        await Metadata.delete(fromUri, fromHash);
        await Metadata.setEntry(toUri, toHash, fromMetaEntry);
      }

      // 4. Move metadata to the new path
      await Metadata.createDefault(toUri, toHash);
    }
  }
}
