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

import * as vscode from 'vscode';
import fs from 'fs';
import {Metadata} from './Metadata';
import {generateHash} from './Utils';



class MetadataSynchronizer{
  static async run(flattenMap: any) {


    /**  1. Create metadata if pathToHash exists but does not have actual metadata files,
     *      If pathToHash exists and there is a actual metadata file, but there is no path inside, create
     *      a path and data insde
     */
    await this.createMetadata(flattenMap);

    // 2. Replace is_deleted with true for all metadata not in pathToHash
    await this.deleteMetadata(flattenMap);
  }

  static async createMetadata(flattenMap: any) {
    for (let path in flattenMap) {
      const hash = flattenMap[path];
      if(vscode.workspace.workspaceFolders){
        await Metadata.createDefault(vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, path), hash);
      }
    }
  }

  static async deleteMetadata(flattenMap: any) {
    if (vscode.workspace.workspaceFolders === undefined) {
      return;
    }
    const baseUri =
        vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, '.meta/hash_objects');
    const files = await vscode.workspace.fs.readDirectory(baseUri);
    for (const file of files) {
      const hashFolderUri = vscode.Uri.joinPath(baseUri, file[0]);
      const hashList = await vscode.workspace.fs.readDirectory(hashFolderUri);
      for (const hashFile of hashList) {
        const hashUri = vscode.Uri.joinPath(hashFolderUri, hashFile[0]);
        let metaObj =
            JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(hashUri)).toString());
        const hash = file[0] + hashFile[0].split('.')[0];
        for (const path in metaObj) {
          if(flattenMap[path] === undefined){
            const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, path);
            await Metadata.disable(uri, hash);
          }
        }
      }
    }
  }
}

/**
 * A Singleton Object
 * 
 * PathToHash is a data structure that stores the path of the actual data 
 * and the hash value generated by the contents of the actual data
 * to synchronize the actual data and metadata
 */

export class PathToHash {
  private static _instance: PathToHash;
  private _map: any;

  private constructor() {}

  public static async getInstance() {
    if (!this._instance) {
      this._instance = new PathToHash();
      this._instance._map = await this._instance.init();
    }
    return this._instance;
  }

  private async init() {
    if (vscode.workspace.workspaceFolders === undefined) {
      return;
    }
    const uri = vscode.workspace.workspaceFolders[0].uri;
    const map = await this.scanRecursively(uri);
    const temp= await this.getFlatMap(map);
    await MetadataSynchronizer.run(temp);
    return map;
  }

  private async scanRecursively(uri: vscode.Uri) {
    let subMap: {[key: string]: any} = {};
    const files = await vscode.workspace.fs.readDirectory(uri);

    for (const file of files) {
      const name: string = file[0];
      const type: number = file[1];

      if (type === 1) {  // TODO: .model .cfg .circle .log 아니면 제외(.txt파일의 메타데이터가 생성되네요)
        subMap[name] = await generateHash(vscode.Uri.joinPath(uri, '/' + name));
      } else if (type === 2 && name !== '.meta') {
        subMap[name] = await this.scanRecursively(vscode.Uri.joinPath(uri, '/' + name));
      }
    }
    if(subMap === {}) {  // FIXME: JavaScript는 값이 아닌 참조로 개체를 비교하므로 이 조건은 항상 'false'을(를) 반환합니다.
      return;
    }

    return subMap;
  }

  private async getFlatMap(map: any) {
    let flatMap: any = {};
    let queue = [];
    for (let data in map) {
      queue.push([map[data], data.toString()]);
    }
    while (queue.length !== 0) {
      const node = queue.pop();
      if (node === undefined) {
        continue;
      }
      if (vscode.workspace.workspaceFolders === undefined) {
        break;
      }
      let path = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, node[1]).path;
      if (fs.lstatSync(path).isDirectory()) {
        for (let key in node[0]) {
          queue.push([node[0][key], node[1] + '/' + key]);
        }
      } else {
        flatMap[node[1]] = node[0];
      }
    }
    return flatMap;
  }


  /**
   * @brief Obtain a hash of the file of given 'uri' by searching in the map
   * @param uri 
   * @returns hash :string
   */
  getHash(uri: vscode.Uri) {
    const splitPath = vscode.workspace.asRelativePath(uri).split('/');
    let map = this._map;

    splitPath.forEach((path) => {
      if (map === undefined) {
        return undefined;
      }
      map = map[path];
    });

    return map;
  }

  getFilesUnderFolder(uri: vscode.Uri) {
    const folder = this.getHash(uri);
    const files: vscode.Uri[] = [];
    if (typeof (folder) === 'string') {
      // not a folder
      return files;
    }
    for (const name in folder) {
      files.push(vscode.Uri.joinPath(uri, name));
    }

    return files;
  }

  /**
   * @brief Input uri, extract path and hash values, and store them in a '_map'
   */  
  async add(uri: vscode.Uri) {
    const relPath = vscode.workspace.asRelativePath(uri);
    const splitPath = relPath.split('/');
    let content: any = await generateHash(uri);
    let subMap = this._map;
    let idx = 0;
    for (let path = splitPath[idx]; idx < splitPath.length - 1; path = splitPath[++idx]) {
      if (!subMap[path]) {
        break;
      }
      subMap = subMap[path];
    }
    if (splitPath.length - 1 === idx) {  // paths.length - 1: index of a file name
      // When all of the folder path are stored in pathToHash
      // update / create pathToHash for a file
      subMap[splitPath[idx]] = content;
      return;
    }

    for (let i = splitPath.length - 1; i > idx; --i) {
      let tempContent: {[key: string]: any} = {};
      tempContent[splitPath[i]] = content;
      content = tempContent;
    }
    subMap[splitPath[idx]] = content;
}

  /**
   * @param uri 
   * @brief Input uri, extract path and hash values, and delete them in a '_map'
   */
  delete(uri: vscode.Uri) {
    let subMap = this._map;
    const splitPath = vscode.workspace.asRelativePath(uri).split('/');

    for (let i = 0, name = splitPath[i]; i < splitPath.length - 1; name = splitPath[++i]) {
      if (!subMap) {
        return;
      }
      subMap = subMap[name];
    }
    if (subMap === undefined) {
      // already deleted
      return;
    }
    delete subMap[splitPath[splitPath.length - 1]];
    if (splitPath.length > 1) {
      this.deleteEmptyDirPath(this._map, splitPath, 0);
    }
  }

  /**
   * @brief This function runs after deleting a particular file path from the '_map'
   * and deletes all empty directories up to the deleted file path.
   * To this end, the variable that recursively searches for '_map' is subMap,
   * and if 'subMap[splitPath[idx]]' is empty, it is deleted.
   * @param subMap 
   * @param splitPath 
   * @param idx 
   */
  deleteEmptyDirPath(subMap: any, splitPath: string[], idx: number) {
    const name = splitPath[idx];
    if (splitPath.length - 2 === idx) {
      if (Object.keys(subMap[name]).length === 0) {
        delete subMap[name];
      }
      return;
    }
    if (subMap[name] === undefined) {
      return;
    }
    this.deleteEmptyDirPath(subMap[name], splitPath, idx + 1);
    if (Object.keys(subMap[name]).length === 0) {
      delete subMap[name];
    }
  }
}